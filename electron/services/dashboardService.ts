import { MCPService } from "./mcpService";
import { ToolRegistry } from "./toolRegistry";
import { LLMService } from "./llmService";
import { DashboardPromptService } from "./dashboardPromptService";
import type { FileService } from "./fileService";

export interface DashboardQueryRequest {
  question: string;
  tileType?: string;
}

export interface DashboardQueryResponse {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * DashboardQueryService manages the dashboard query flow (Phase 4 - decoupled):
 * 1. Use DashboardPromptService to create format-agnostic prompts
 * 2. Call LLM with structured prompt (LLM uses RAG tools)
 * 3. Format LLM response using dashboard MCP server (pure formatter)
 */
export class DashboardQueryService {
  constructor(
    private mcpService: MCPService,
    private toolRegistry: ToolRegistry,
    private llmService: LLMService,
    private promptService: DashboardPromptService,
    private fileService?: FileService,
  ) {}

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  private async tryCsvGraphShortcut(
    question: string,
    tileType: string,
  ): Promise<DashboardQueryResponse | null> {
    if (!this.fileService) return null;
    if (tileType !== "graph") return null;

    const q = String(question || "");
    const match = q.match(/workbook:\/\/([^/]+)\/([^\s)'"`]+\.csv)\b/i);
    if (!match) return null;
    const workbookId = match[1];
    const relativePath = match[2].replace(/^\/+/, "");

    try {
      const csv = await this.fileService.readDocument(workbookId, relativePath);
      const lines = String(csv || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length < 2) return null;

      const headers = this.parseCsvLine(lines[0]).map((h) => h.trim());
      if (!headers.length) return null;

      const rows = lines.slice(1).map((ln) => {
        const cols = this.parseCsvLine(ln);
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
        return obj;
      });

      // Determine year filter (e.g., 2025)
      const yearMatch = q.match(/\b(20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : null;

      const hLower = headers.map((h) => h.toLowerCase());
      const pickHeaderIndex = (cands: string[]) => {
        for (const cand of cands) {
          const idx = hLower.findIndex((h) => h.includes(cand));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const valueIdx = pickHeaderIndex(["budget", "cost", "amount", "total", "spend", "usd", "dollars"]);
      const labelIdx = pickHeaderIndex(["category", "project", "item", "name", "department", "month"]);
      const yearIdx = pickHeaderIndex(["year"]);
      const dateIdx = pickHeaderIndex(["date"]);

      if (valueIdx < 0 || labelIdx < 0) return null;

      const totals = new Map<string, number>();
      for (const r of rows) {
        // Filter by year if requested.
        if (year) {
          const yv = yearIdx >= 0 ? (r[headers[yearIdx]] || "").trim() : "";
          const dv = dateIdx >= 0 ? (r[headers[dateIdx]] || "").trim() : "";
          if (yv && yv !== year) continue;
          if (!yv && dv && !dv.startsWith(year)) continue;
          if (!yv && !dv && yearIdx >= 0) continue;
        }

        const label = String(r[headers[labelIdx]] || "").trim();
        if (!label) continue;
        const rawV = String(r[headers[valueIdx]] || "").trim();
        const v = Number(rawV.replace(/[^0-9.\-]/g, ""));
        if (!Number.isFinite(v)) continue;
        totals.set(label, (totals.get(label) || 0) + v);
      }

      const labels = Array.from(totals.keys()).sort((a, b) => a.localeCompare(b));
      const values = labels.map((l) => totals.get(l) || 0);

      // If we can't produce a multi-point graph, fall back to LLM (or empty graph elsewhere).
      if (labels.length < 2) return null;

      return {
        success: true,
        result: {
          type: "graph",
          chartType: "bar",
          data: { labels, values },
          title: year ? `Totals (${year})` : "Totals",
          sources: [{ workbookId, filePath: relativePath, filename: relativePath.split("/").pop() }],
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Execute a dashboard query using the decoupled 3-step flow (Phase 4)
   */
  async executeQuery(request: DashboardQueryRequest): Promise<DashboardQueryResponse> {
    try {
      // Step 0: Find dashboard server for formatting (only needs format_llm_response tool)
      const dashboardServer = this.toolRegistry.getToolServer("format_llm_response");
      if (!dashboardServer) {
        return {
          success: false,
          error: "No dashboard formatting server available. Please ensure a dashboard MCP server is running."
        };
      }

      if (!this.mcpService.isServerRunning(dashboardServer)) {
        return {
          success: false,
          error: `Dashboard server ${dashboardServer} is not running`
        };
      }

      // Step 1: Create prompt using DashboardPromptService (decoupled from MCP)
      const promptResponse = this.promptService.createPrompt({
        question: request.question,
        tileType: request.tileType || "counter"
      });

      if (!promptResponse.success || !promptResponse.prompt) {
        return {
          success: false,
          error: promptResponse.error || "Failed to create prompt"
        };
      }

      // Deterministic shortcut: CSV-backed graph aggregation for common desktop use-cases.
      // This avoids brittle LLM extraction for straightforward CSV bar charts.
      const shortcut = await this.tryCsvGraphShortcut(request.question, promptResponse.tileType || (request.tileType || "counter"));
      if (shortcut) return shortcut;

      // Step 2: Call LLM with structured prompt (LLM will use RAG tools)
      const llmMessages = [
        { role: "system" as const, content: promptResponse.prompt.systemPrompt },
        { role: "user" as const, content: promptResponse.prompt.userQuestion }
      ];

      // Dashboards must be stable and not vary with the currently selected Context.
      // Run the LLM/tool burst unscoped (all workbooks) unless the prompt/tool args explicitly scope.
      const llmResponse = await this.llmService.chat(llmMessages, { ignoreContextScope: true });
      const sources = this.extractSourcesFromLLMResponse(llmResponse);

      // Log for debugging
      console.log("[DashboardService] Question:", request.question);
      console.log("[DashboardService] Tile Type:", request.tileType || "counter");
      console.log("[DashboardService] LLM Response:", llmResponse.substring(0, 200));

      // Step 3: Format LLM response using dashboard MCP server (pure formatter)
      const formatResponse = await this.mcpService.sendRequest(
        dashboardServer,
        "tools/call",
        {
          name: "format_llm_response",
          arguments: {
            llmResponse: llmResponse,
            tileType: promptResponse.tileType
          }
        }
      );

      // MCP service returns the result field from JSON-RPC response
      const rawFormatted = formatResponse?.result || formatResponse;

      // Normalize formatter output to the DashboardResult shape expected by the renderer.
      // Some formatter versions return { success, result } wrappers; the UI expects the inner `result`.
      const formattedResult = (() => {
        try {
          if (rawFormatted && typeof rawFormatted === "object") {
            const anyRes: any = rawFormatted;
            if (typeof anyRes.success === "boolean") {
              if (anyRes.success && anyRes.result) return anyRes.result;
              const msg =
                typeof anyRes.error === "string"
                  ? anyRes.error
                  : "Dashboard formatter failed to produce a valid result";
              return { type: "error", error: msg };
            }
          }
          // If formatter already returns a DashboardResult object, pass it through.
          return rawFormatted;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error normalizing dashboard result";
          return { type: "error", error: msg };
        }
      })();

      // Attach sources when possible (renderer can show View Sources per tile).
      try {
        if (sources.length && formattedResult && typeof formattedResult === "object") {
          (formattedResult as any).sources = sources;
        }
      } catch {
        // ignore
      }

      console.log("[DashboardService] Formatted Result:", JSON.stringify(formattedResult).substring(0, 200));

      return {
        success: true,
        result: formattedResult
      };
    } catch (error) {
      console.error("[DashboardService] Error in dashboard query:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  private extractSourcesFromLLMResponse(
    llmResponse: string,
  ): Array<{ workbookId: string; filePath: string; filename?: string }> {
    try {
      const text = String(llmResponse || "");
      const re = /\(workbook:\/\/([^/]+)\/([^)]+)\)/g;
      const out: Array<{ workbookId: string; filePath: string; filename?: string }> = [];
      const seen = new Set<string>();
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const workbookId = m[1];
        const encodedPath = m[2];
        const filePath = encodedPath
          .split("/")
          .map((p) => {
            try {
              return decodeURIComponent(p);
            } catch {
              return p;
            }
          })
          .join("/");
        const key = `${workbookId}:${filePath}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const filename = filePath.split("/").pop();
        out.push({ workbookId, filePath, filename });
      }
      return out;
    } catch {
      return [];
    }
  }

  /**
   * Check if dashboard capabilities are available (Phase 4 - format-agnostic)
   */
  isAvailable(): boolean {
    const dashboardServer = this.toolRegistry.getToolServer("format_llm_response");
    return dashboardServer !== undefined &&
           this.mcpService.isServerRunning(dashboardServer);
  }

  /**
   * Get the name of the dashboard server currently in use
   */
  getDashboardServerName(): string | undefined {
    return this.toolRegistry.getToolServer("format_llm_response");
  }
}
