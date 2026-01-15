import * as fs from "fs";
import * as path from "path";
import { BrowserWindow } from "electron";
import { LLMConfig } from "./configService";
import { WorkbookService } from "./workbookService";
import { FileService } from "./fileService";
import { MCPService } from "./mcpService";
import { ToolRegistry } from "./toolRegistry";
import { ToolProviderRegistry } from "./toolProviderRegistry";
import { ToolExecutionContext } from "./types/toolProvider";

export interface LLMMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

export type LLMActivityEvent =
  | { kind: "thinking"; requestId: string; ts: number; message?: string }
  | {
      kind: "tool_start";
      requestId: string;
      ts: number;
      stepId: string;
      toolName: string;
      serverName: string;
      argsSummary?: string;
    }
  | {
      kind: "tool_end";
      requestId: string;
      ts: number;
      stepId: string;
      toolName: string;
      serverName: string;
      ok: boolean;
      durationMs?: number;
      error?: string;
    };

export class LLMService {
  private config: LLMConfig;
  private workbookService: WorkbookService;
  private fileService: FileService;
  private ragIndexService?: any; // RAGIndexService
  private mcpService?: MCPService;
  private toolRegistry: ToolRegistry;
  private toolProviderRegistry?: ToolProviderRegistry;
  private availableTools: ToolDefinition[] = [];
  private filesReadInCurrentChat: Array<{ workbookId: string; workbookName: string; filePath: string; filename: string }> = [];
  private activityCtx: null | { requestId: string; emit: (evt: LLMActivityEvent) => void } = null;
  private toolStartTimes: Map<string, number> = new Map();

  /**
   * Cached active context scope for the current request / tool execution burst.
   * - null: not yet loaded
   * - { contextId: null }: no active context
   * - { contextId: string, workbookIds: Set<string> }: scope active
   */
  private cachedContextScope: null | { contextId: string | null; workbookIds: Set<string> | null } = null;
  private disableContextScopingForRequest: boolean = false;

  constructor(
    config: LLMConfig,
    workbookService: WorkbookService,
    fileService: FileService,
    ragIndexService?: any,
    mcpService?: MCPService,
    toolRegistry?: ToolRegistry,
    toolProviderRegistry?: ToolProviderRegistry,
  ) {
    this.config = config;
    this.workbookService = workbookService;
    this.fileService = fileService;
    this.ragIndexService = ragIndexService;
    this.mcpService = mcpService;
    this.toolRegistry = toolRegistry || new ToolRegistry();
    this.toolProviderRegistry = toolProviderRegistry;

    // Subscribe to tool registry changes
    this.toolRegistry.subscribe((tools) => {
      this.updateAvailableTools();
    });

    // Register core tools through ToolRegistry for consistency
    this.registerCoreTools();
    this.updateAvailableTools();
  }

  /**
   * Live-update the LLM provider config (used by Settings UI).
   * This is intentionally fail-soft: callers can validate separately.
   */
  setConfig(next: LLMConfig) {
    this.config = next;
  }

  getConfig(): LLMConfig {
    return this.config;
  }

  /**
   * Attach a short-lived activity emitter for the duration of a single chat request.
   * Fail-soft: activity is optional and should never break chat.
   */
  private async withActivity<T>(
    requestId: string | undefined,
    emit: ((evt: LLMActivityEvent) => void) | undefined,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!requestId || !emit) return await fn();
    const prev = this.activityCtx;
    this.activityCtx = { requestId, emit };
    try {
      return await fn();
    } finally {
      this.activityCtx = prev;
      this.toolStartTimes.clear();
    }
  }

  // NOTE: intentionally loose typing to avoid union excess-property headaches in TS builds.
  // This is internal-only and must remain fail-soft.
  private emitActivity(evt: any) {
    const ctx = this.activityCtx;
    if (!ctx) return;
    try {
      ctx.emit({
        ...(evt || {}),
        requestId: ctx.requestId,
        ts: typeof evt?.ts === "number" ? evt.ts : Date.now(),
      } as LLMActivityEvent);
    } catch {
      // ignore
    }
  }

  private safeArgsSummary(args: Record<string, any>): string | undefined {
    try {
      const redacted: Record<string, any> = {};
      for (const [k, v] of Object.entries(args || {})) {
        const key = String(k);
        const lower = key.toLowerCase();
        if (lower.includes("key") || lower.includes("token") || lower.includes("password")) {
          redacted[key] = "[redacted]";
          continue;
        }
        if (typeof v === "string") {
          redacted[key] = v.length > 200 ? v.slice(0, 200) + "…" : v;
          continue;
        }
        if (Array.isArray(v)) {
          redacted[key] = v.length > 10 ? [...v.slice(0, 10), `…(+${v.length - 10})`] : v;
          continue;
        }
        if (typeof v === "object" && v) {
          redacted[key] = "[object]";
          continue;
        }
        redacted[key] = v;
      }
      const text = JSON.stringify(redacted);
      return text.length > 280 ? text.slice(0, 280) + "…" : text;
    } catch {
      return undefined;
    }
  }

  async listModels(): Promise<Array<{ id: string; label?: string }>> {
    const provider = this.config.provider;
    if (provider === "openai") {
      if (!this.config.apiKey) throw new Error("OpenAI apiKey is not configured");
      const res = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`OpenAI models error: ${res.status} ${res.statusText} - ${text}`);
      const json = JSON.parse(text);
      const data = Array.isArray(json?.data) ? json.data : [];
      const models = data
        .map((m: any) => ({ id: String(m?.id || "").trim() }))
        .filter((m: any) => m.id);
      models.sort((a: any, b: any) => a.id.localeCompare(b.id));
      return models;
    }

    if (provider === "claude") {
      if (!this.config.apiKey) throw new Error("Claude apiKey is not configured");
      const res = await fetch("https://api.anthropic.com/v1/models", {
        method: "GET",
        headers: {
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Claude models error: ${res.status} ${res.statusText} - ${text}`);
      const json = JSON.parse(text);
      const data = Array.isArray(json?.data) ? json.data : [];
      const models = data
        .map((m: any) => ({
          id: String(m?.id || "").trim(),
          label: typeof m?.display_name === "string" ? m.display_name : undefined,
        }))
        .filter((m: any) => m.id);
      models.sort((a: any, b: any) => a.id.localeCompare(b.id));
      return models;
    }

    // ollama + gateways (including lmsvr)
    const baseUrl = this.config.baseUrl || "http://localhost:11434";
    const headers: Record<string, string> = {};
    if (this.config.apiKey && String(this.config.apiKey).trim()) {
      headers.Authorization = `Bearer ${String(this.config.apiKey).trim()}`;
    }

    // Try lmsvr gateway first: /api/models
    const tryUrls = [`${baseUrl.replace(/\/+$/, "")}/api/models`, `${baseUrl.replace(/\/+$/, "")}/api/tags`];
    let lastErr: any = null;
    for (const url of tryUrls) {
      try {
        const res = await fetch(url, { method: "GET", headers });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
        const json = JSON.parse(text);

        // lmsvr may return { models: [...] } or { data: [...] }
        const arr =
          (Array.isArray(json?.models) && json.models) ||
          (Array.isArray(json?.data) && json.data) ||
          [];
        const models = arr
          .map((m: any) => {
            if (typeof m === "string") return { id: m.trim() };
            // ollama tags returns { models: [{ name }] }
            if (typeof m?.name === "string") return { id: m.name.trim() };
            if (typeof m?.id === "string") return { id: m.id.trim() };
            if (typeof m?.model === "string") return { id: m.model.trim() };
            return { id: "" };
          })
          .filter((m: any) => m.id);

        models.sort((a: any, b: any) => a.id.localeCompare(b.id));
        return models;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error("Failed to list Ollama models");
  }

  /**
   * Register core tools through ToolRegistry (for consistency with MCP tools)
   */
  private registerCoreTools() {
    const coreTools: ToolDefinition[] = [
      {
        name: "read_workbook_file",
        description:
          "Read the contents of a file in a workbook. Use this to see what documents contain.",
        parameters: {
          type: "object",
          properties: {
            workbookId: {
              type: "string",
              description: "The ID of the workbook (this is the directory name, e.g., 'ac1000-main-project', NOT a UUID). Get this from the 'Workbook ID:' field in RAG search results.",
            },
            filePath: {
              type: "string",
              description:
                'The relative path to the file within the workbook (e.g., "documents/file.txt")',
            },
          },
          required: ["workbookId", "filePath"],
        },
      },
      {
        // Back-compat alias: some models will try "read_workbook" when asked to inspect a workbook.
        // This returns a workbook's structure (folders + documents) so the model can count/locate files.
        name: "read_workbook",
        description:
          "Read a workbook's structure (folders + documents). Provide id (workbook id). Use this to count documents or discover file paths.",
        parameters: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description:
                "Workbook ID (directory name, e.g., 'ac1000-main-project', NOT a UUID).",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "list_workbooks",
        description:
          "List all available workbooks and their documents. Use this to see what workbooks exist.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "create_file_in_workbook",
        description:
          "Create or overwrite a file in a workbook. Use the correct file extension based on the requested artifact (e.g., .md, .csv, .is).",
        parameters: {
          type: "object",
          properties: {
            workbookId: {
              type: "string",
              description: "The ID of the workbook where to create the file",
            },
            fileName: {
              type: "string",
              description:
                'The name of the file to create (e.g., "summary.md", "analysis.md")',
            },
            content: {
              type: "string",
              description: "The content to write to the file",
            },
          },
          required: ["workbookId", "fileName", "content"],
        },
      },
      {
        name: "create_insight_sheet",
        description:
          "Create a new Insight Sheet (.is) JSON file in a workbook using the canonical schema (version/metadata/sheets/cells/formats). Use this whenever the user asks to create a new .is sheet.",
        parameters: {
          type: "object",
          properties: {
            workbookId: {
              type: "string",
              description: "Workbook ID where the .is file will be created",
            },
            fileName: {
              type: "string",
              description: 'Filename for the sheet (e.g., "trade-model.is" or "documents/trade-model.is")',
            },
            sheetName: {
              type: "string",
              description: 'Initial visible sheet name (e.g., "Decision Matrix")',
            },
            title: {
              type: "string",
              description: 'Human-friendly title stored in metadata.name (defaults to fileName)',
            },
          },
          required: ["workbookId", "fileName"],
        },
      },
      {
        name: "upsert_insight_sheet_cells",
        description:
          "Update an Insight Sheet (.is) by setting cell values and/or formulas using the schema the spreadsheet editor expects. Use this to add rows/columns, totals, or formulas instead of guessing JSON keys.",
        parameters: {
          type: "object",
          properties: {
            workbookId: { type: "string", description: "Workbook ID containing the .is file" },
            filePath: { type: "string", description: 'Path to the .is file (e.g., "documents/new-sheet.is")' },
            sheetName: { type: "string", description: "Optional: target sheet name (defaults to first sheet)" },
            updates: {
              type: "array",
              description:
                "Cell updates. Each item can set a plain value, a formula, or both (value is optional cached value).",
              items: {
                type: "object",
                properties: {
                  cell: { type: "string", description: 'Cell reference like "A1", "D6"' },
                  value: { description: "Plain value (string/number/bool) to store in the cell" },
                  formula: { type: "string", description: 'Formula string like "=B2*C2" or "B2*C2"' },
                },
                required: ["cell"],
              },
            },
          },
          required: ["workbookId", "filePath", "updates"],
        },
      },
      {
        name: "search_workbooks",
        description:
          "Search for files across workbooks by filename. Use this to find relevant documents.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query (filename)" },
          },
          required: ["query"],
        },
      },
      {
        name: "list_all_workbook_files",
        description:
          "List all files in all workbooks. Use this to see what documents are available.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];
    
    // Register core tools with ToolRegistry (serverName="core")
    this.toolRegistry.registerTools("core", coreTools);
    console.log(`[LLM] Registered ${coreTools.length} core tools`);
  }

  /**
   * Update available tools from ToolRegistry
   */
  private updateAvailableTools(): void {
    this.availableTools = this.toolRegistry.getAllTools();
    const coreCount = this.toolRegistry.getToolsByServer("core").length;
    const mcpCount = this.availableTools.length - coreCount;
    console.log(`[LLM] Updated available tools: ${coreCount} core + ${mcpCount} MCP = ${this.availableTools.length} total`);
  }

  async chat(
    messages: LLMMessage[],
    options?: { ignoreContextScope?: boolean; requestId?: string; emitActivity?: (evt: LLMActivityEvent) => void },
  ): Promise<string> {
    return this.withActivity(options?.requestId, options?.emitActivity, async () => {
      this.emitActivity({ kind: "thinking", message: "Thinking…" });

      // Reset files read tracker for new chat request
      this.filesReadInCurrentChat = [];
      // Reset cached context scope per chat request (so active context changes apply immediately)
      this.cachedContextScope = null;
      this.disableContextScopingForRequest = !!options?.ignoreContextScope;

      // Add system message with tool definitions if not present
      const systemMessage: LLMMessage = {
        role: "system",
        content: this.getSystemPrompt(),
      };

      const messagesWithSystem = messages.some((m) => m.role === "system")
        ? messages
        : [systemMessage, ...messages];

      // Lightweight @refs / workbook:// references:
      // If the user explicitly references workbook://... paths, preload those files (fail-soft)
      // and inject their contents as an additional system message for grounding + citations.
      const refSystem = await this.buildExplicitWorkbookRefsSystemMessage(messagesWithSystem);
      const finalMessages =
        refSystem && messagesWithSystem[0]?.role === "system"
          ? [messagesWithSystem[0], refSystem, ...messagesWithSystem.slice(1)]
          : refSystem
            ? [refSystem, ...messagesWithSystem]
            : messagesWithSystem;

      let response: string;
      try {
        switch (this.config.provider) {
          case "openai":
            response = await this.chatWithToolsOpenAI(finalMessages);
            break;
          case "claude":
            response = await this.chatWithToolsClaude(finalMessages);
            break;
          case "ollama":
            response = await this.chatWithToolsOllama(finalMessages);
            break;
          default:
            throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
        }
      } finally {
        // Ensure per-request override never leaks across calls.
        this.disableContextScopingForRequest = false;
      }

      // Add file references if any files were read
      if (this.filesReadInCurrentChat.length > 0) {
        const seen = new Set<string>();
        const unique = this.filesReadInCurrentChat.filter((f) => {
          const key = `${String(f.workbookId || "").trim()}::${String(f.filePath || "").trim()}`;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const references = unique
          .map((f) => {
            // URL-encode the file path to handle spaces and special characters
            const encodedPath = String(f.filePath || "")
              .split("/")
              .map((part) => encodeURIComponent(part))
              .join("/");
            return `📄 [${f.filename}](workbook://${f.workbookId}/${encodedPath})`;
          })
          .join("\n\n");
        response += `\n\n---\n\n**Sources:**\n\n${references}`;
      }

      return response;
    });
  }

  private parseWorkbookRefs(text: string): Array<{ workbookId: string; filePath: string; raw: string }> {
    const out: Array<{ workbookId: string; filePath: string; raw: string }> = [];
    const re = /workbook:\/\/([^\s/]+)\/([^\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(String(text || ""))) !== null) {
      const raw = m[0];
      const workbookId = String(m[1] || "").trim();
      let tail = String(m[2] || "").trim();
      // Trim common trailing punctuation.
      tail = tail.replace(/[)\],.]+$/g, "");
      if (!workbookId || !tail) continue;

      const filePath = tail
        .split("/")
        .map((part) => {
          try {
            return decodeURIComponent(part);
          } catch {
            return part;
          }
        })
        .join("/");

      out.push({ workbookId, filePath, raw });
    }
    return out;
  }

  private broadcast(channel: string, payload?: any) {
    try {
      for (const w of BrowserWindow.getAllWindows()) {
        try {
          w.webContents.send(channel, payload);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  private async buildExplicitWorkbookRefsSystemMessage(messages: LLMMessage[]): Promise<LLMMessage | null> {
    // Only consider the most recent user message (keeps prompt size predictable/deterministic).
    const lastUser = [...messages].reverse().find((m) => m.role === "user" && typeof m.content === "string");
    if (!lastUser?.content) return null;

    const refs = this.parseWorkbookRefs(lastUser.content);
    if (refs.length === 0) return null;

    const scope = await this.getActiveContextScope();
    const isInScope = (workbookId: string) => !scope.workbookIds || scope.workbookIds.has(workbookId);

    const seen = new Set<string>();
    const blocks: string[] = [];
    for (const ref of refs.slice(0, 5)) {
      const key = `${ref.workbookId}:${ref.filePath}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Report explicit ref loading as an "action" in the activity stream (not a model tool-call).
      const stepId = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.toolStartTimes.set(stepId, Date.now());
      this.emitActivity({
        kind: "tool_start",
        stepId,
        toolName: "load_workbook_ref",
        serverName: "core",
        argsSummary: this.safeArgsSummary({ workbookId: ref.workbookId, filePath: ref.filePath }),
      });

      if (!isInScope(ref.workbookId)) {
        blocks.push(
          `- ${ref.raw}\n  (Out of active Context scope; content not loaded.)`,
        );
        const start = this.toolStartTimes.get(stepId) || Date.now();
        this.emitActivity({
          kind: "tool_end",
          stepId,
          toolName: "load_workbook_ref",
          serverName: "core",
          ok: false,
          durationMs: Date.now() - start,
          error: "Out of active Context scope",
        });
        continue;
      }

      try {
        const content = await this.fileService.readDocument(ref.workbookId, ref.filePath);
        const trimmed = String(content || "");
        const cap = trimmed.length > 12000 ? trimmed.slice(0, 12000) + "\n\n[...truncated...]" : trimmed;

        // Track for citations in the response footer.
        try {
          const wb = await this.workbookService.getWorkbook(ref.workbookId);
          const filename = ref.filePath.split("/").pop() || ref.filePath;
          this.filesReadInCurrentChat.push({
            workbookId: ref.workbookId,
            workbookName: wb?.name || ref.workbookId,
            filePath: ref.filePath,
            filename,
          });
        } catch {
          // ignore
        }

        blocks.push(
          `- ${ref.raw}\n\nFile content:\n${cap}`,
        );
        const start = this.toolStartTimes.get(stepId) || Date.now();
        this.emitActivity({
          kind: "tool_end",
          stepId,
          toolName: "load_workbook_ref",
          serverName: "core",
          ok: true,
          durationMs: Date.now() - start,
        });
      } catch (e) {
        // Fail-soft: It's common for the user/LLM to reference a file that will be created later
        // in the same request (e.g., "create workbook://.../documents/new.ipynb"). Treat missing
        // files as a non-fatal "not loaded yet" state so the Activity stream doesn't look broken.
        const msg = e instanceof Error ? e.message : "Failed to load";
        const isMissing =
          /File not found/i.test(msg) ||
          /ENOENT/i.test(msg);

        blocks.push(
          `- ${ref.raw}\n  (${isMissing ? "Not found (may be created later in this request)" : `Failed to load: ${msg}`})`,
        );
        const start = this.toolStartTimes.get(stepId) || Date.now();
        this.emitActivity({
          kind: "tool_end",
          stepId,
          toolName: "load_workbook_ref",
          serverName: "core",
          ok: isMissing ? true : false,
          durationMs: Date.now() - start,
          error: isMissing ? undefined : msg,
        });
      }
    }

    if (blocks.length === 0) return null;

    return {
      role: "system",
      content:
        `User provided explicit workbook references. Use the loaded file contents below as grounding when answering.\n\n` +
        blocks.join("\n\n---\n\n"),
    };
  }

  /**
   * Track files from RAG server response
   * RAG response format:
   * **filename** (workbook)
   * Workbook ID: xxx
   * Path: yyy
   */
  private trackFilesFromRAGResponse(content: string): void {
    const filePattern = /\*\*([^*]+)\*\*\s*\(([^)]+)\)\s*\n\s*Workbook ID:\s*([^\n]+)\s*\n\s*Path:\s*([^\n]+)/g;

    let match;
    const seenFiles = new Set<string>();

    while ((match = filePattern.exec(content)) !== null) {
      const filename = match[1].trim();
      const workbookName = match[2].trim();
      const workbookId = match[3].trim();
      const filePath = match[4].trim();

      const fileKey = `${workbookId}:${filePath}`;

      if (!seenFiles.has(fileKey)) {
        seenFiles.add(fileKey);
        this.filesReadInCurrentChat.push({
          workbookId,
          workbookName,
          filePath,
          filename
        });
      }
    }
  }

  private getSystemPrompt(toolsForPrompt: Array<{ name: string; description: string }> = this.availableTools): string {
    return `You are an AI assistant helping users manage and analyze their workbooks and documents.

CRITICAL: When users ask questions about document content, you MUST:
1. If the user is asking for an **exact match** (or gives a regex/pattern) across many files, use **rag_grep** FIRST.
   - Use rag_grep for: identifiers, error codes, exact phrases, config keys, file paths, "where does X appear?", and regex patterns.
   - Examples:
     - "Find all places we reference insightlm:workbooks:filesChanged" → rag_grep(pattern="insightlm:workbooks:filesChanged")
     - "Search for ERROR_\\d+ in docs" → rag_grep(pattern="ERROR_\\\\d+", regex=true)
     - "Where is function openDocument used?" → rag_grep(pattern="openDocument", regex=false)
2. Otherwise, for **semantic questions** (summaries/explanations) or when the user mentions a filename but you need to find the right file, use **rag_search_content** FIRST.
   - rag_search_content searches INSIDE files (PDFs, Word docs, spreadsheets, text files) and can find files by filename or by meaning/terms.
3. After rag_search_content returns results, use read_workbook_file with the exact Workbook ID and Path from the search results to read the full file.
4. Answer based on what you READ from the files.

IMPORTANT: Use rag_search_content when users ask about:
- Filenames (e.g., "spreadsheet-2025-12-12T19-46-01.is", "test-spreadsheet.is")
- Specific terms or concepts (e.g., "What is BSEO?", "authentication methods")
- Information that might be inside documents (not just filenames)
- Questions where you need to search document content, not just metadata
- Cell values or formulas in spreadsheets (e.g., "what is cell C1")

DO NOT try to answer questions about document content without searching or reading the files first.
DO NOT use list_all_workbook_files or read_workbook_file directly without first using rag_search_content (or rag_grep when appropriate) to find the right file(s).

IMPORTANT: Do NOT include a "Sources:" section in your response. The system will automatically add source references at the end.

NOTEBOOKS (.ipynb):
- If notebook-related tools are available (e.g. create/execute), use them to create and run notebooks.
- If the user asks to "run" code, prefer an execution tool (do not fabricate results by writing outputs into a notebook file).

CONTEXT SCOPING:
- If there is an active Context, tools that list/search files and workbooks are automatically scoped to that Context's workbooks.
- If there is no active Context, tools operate across all workbooks.

Available tools:
${toolsForPrompt.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")}

Example workflow:
User: "What are the key tests for static structural testing?"
You: Call list_all_workbook_files() → find test_plan.md → call read_workbook_file(workbookId, "documents/test_plan.md") → read content → answer with actual content from file

ARTIFACT FORMATS (IMPORTANT):
- Markdown documents: create_file_in_workbook with .md
- CSV data: create_file_in_workbook with .csv
- Insight Sheets: use create_insight_sheet (preferred). If you must write the JSON yourself, use create_file_in_workbook with a .is filename and VALID JSON content in the canonical schema below.

MATH + DIAGRAMS (IMPORTANT):
- Markdown + Chat support LaTeX-style math rendered via KaTeX.
  - Inline math: $E=mc^2$
  - Block math: $$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$
  - Prefer KaTeX-compatible LaTeX (avoid obscure packages/macros).
- Mermaid diagrams are supported via fenced code blocks (language tag: mermaid) in Markdown/Chat.
  - KaTeX-style math in Mermaid labels can work but is BEST-EFFORT (may be flaky depending on diagram/layout/theme).
  - Prefer deterministic output: put the equation as Markdown math *outside* the Mermaid block, and keep Mermaid labels as plain text.

INSIGHT SHEETS (.is) CANONICAL SCHEMA:
- File is JSON (not markdown, not plain text).
- Minimal valid structure:
{
  "version": "1.0",
  "metadata": {
    "name": "Title",
    "created_at": "ISO8601",
    "modified_at": "ISO8601",
    "workbook_id": "<workbookId>"
  },
  "sheets": [
    {
      "id": "sheet-1",
      "name": "Sheet1",
      "cells": { "A1": { "value": "hello" } },
      "formats": {}
    }
  ]
}
- FORMULAS (IMPORTANT):
  - Prefer using upsert_insight_sheet_cells to add formulas.
  - If you must author JSON yourself, formula cells must include a "formula" string (with leading "="), e.g.:
    "cells": {
      "B2": { "value": 10 },
      "C2": { "value": 3 },
      "D2": { "value": null, "formula": "=B2*C2" }
    }
- Always write .is content as JSON exactly in this structure so the spreadsheet editor can open it.

File paths are relative to workbook root (e.g., "documents/filename.ext").`;
  }

  private async executeTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<string> {
    const stepId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const serverName = this.toolRegistry.getToolServer(toolName);

      if (!serverName) {
        return `Unknown tool: ${toolName}`;
      }

      this.toolStartTimes.set(stepId, Date.now());
      // Load active context scope once per tool execution burst.
      // This is used to scope core list/search tools and (when supported) to scope RAG search/list tools.
      const scope = await this.getActiveContextScope();

      // Guardrail: the LLM sometimes confuses "create_workbook" with "create notebook/file".
      // Block obviously-invalid workbook names so the model is forced to retry with the correct tool.
      if (toolName === "create_workbook") {
        const n = String((args as any)?.name || "").trim();
        const looksLikeFile =
          n.toLowerCase().endsWith(".ipynb") ||
          n.toLowerCase().startsWith("workbook://") ||
          n.includes("/") ||
          n.includes("\\") ||
          n.toLowerCase().startsWith("documents/");
        if (looksLikeFile) {
          const start = this.toolStartTimes.get(stepId) || Date.now();
          this.emitActivity({
            kind: "tool_end",
            stepId,
            toolName,
            serverName,
            ok: false,
            durationMs: Date.now() - start,
            error:
              `Invalid create_workbook name "${n}". ` +
              `This looks like a file path. Use create_notebook (workbook://<id>/documents/<name>.ipynb) ` +
              `or create_file_in_workbook instead.`,
          });
          return `Error executing create_workbook: Invalid workbook name "${n}" (looks like a file path).`;
        }
      }

      // If the workbook-rag server supports scoping, inject workbook_ids for active context.
      // This keeps rag_search_content within the active context and prevents cross-context leakage.
      if (
        scope.workbookIds &&
        (toolName === "rag_search_content" || toolName === "rag_list_files") &&
        !Array.isArray(args.workbook_ids)
      ) {
        args = { ...args, workbook_ids: Array.from(scope.workbookIds) };
      }

      // NOTE (decoupling):
      // Do not special-case extension-managed tools (e.g. Jupyter). Any path normalization and
      // tool-specific persistence should happen inside the tool provider / MCP server implementation.

      this.emitActivity({
        kind: "tool_start",
        stepId,
        toolName,
        serverName,
        argsSummary: this.safeArgsSummary(args),
      });

      // Core tools are executed internally
      if (serverName === "core") {
        const out = await this.executeCoreTool(toolName, args);
        const start = this.toolStartTimes.get(stepId) || Date.now();
        this.emitActivity({
          kind: "tool_end",
          stepId,
          toolName,
          serverName,
          ok: true,
          durationMs: Date.now() - start,
        });
        return out;
      }

      // Use ToolProviderRegistry for tool execution (Phase 3 abstraction)
      if (this.toolProviderRegistry) {
        console.log(`[LLM] Executing tool via provider registry: ${toolName} from ${serverName}`);

        const executionContext: ToolExecutionContext = {
          toolName,
          parameters: args,
          timeout: 60000, // 60 second timeout for tool execution
          metadata: {
            requestId: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            // When scoped to a single workbook, propagate it so tool providers can deterministically
            // map relative notebook paths (documents/...) into workbooks/<id>/documents/...
            workbookId: scope.workbookIds?.size === 1 ? Array.from(scope.workbookIds)[0] : undefined
          }
        };

        const result = await this.toolProviderRegistry.executeTool(executionContext);

        if (result.success) {
          // Generic source tracking from tool results:
          // If a tool returns a filesystem path under <dataDir>/workbooks/<id>/..., record it
          // so the response footer includes a clickable workbook:// reference.
          try {
            const maybeResult = result?.result;
            const fsPath =
              (maybeResult && typeof maybeResult === "object" && (maybeResult as any).fs_path) ||
              (maybeResult && typeof maybeResult === "object" && (maybeResult as any).persisted_notebook_fs_path) ||
              null;
            if (typeof fsPath === "string" && fsPath) {
              const normalized = fsPath.replace(/\\/g, "/");
              const idx = normalized.toLowerCase().lastIndexOf("/workbooks/");
              if (idx >= 0) {
                const tail = normalized.slice(idx + "/workbooks/".length);
                const parts = tail.split("/").filter(Boolean);
                const workbookId = parts[0];
                const filePath = parts.slice(1).join("/");
                if (workbookId && filePath) {
                  const wb = await this.workbookService.getWorkbook(workbookId);
                  const filename = filePath.split("/").pop() || filePath;
                  this.filesReadInCurrentChat.push({
                    workbookId,
                    workbookName: wb?.name || workbookId,
                    filePath,
                    filename,
                  });
                }
              }
            }
          } catch {
            // fail-soft
          }
          // Handle rag_search_content specially for file tracking
          if (toolName === "rag_search_content" && result.result?.content) {
            const content = typeof result.result.content === 'string' ? result.result.content : JSON.stringify(result.result.content);
            // Parse RAG response to track sources
            this.trackFilesFromRAGResponse(content);
            // Add explicit instructions for using read_workbook_file with RAG results
            const final =
              content +
              `\n\n[IMPORTANT: When you need to read a file from the search results above, use read_workbook_file with the exact Workbook ID and Path shown. For example, if you see "Workbook ID: ac1000-main-project" and "Path: documents/spreadsheet-2025-12-12T19-46-01.is", call read_workbook_file(workbookId="ac1000-main-project", filePath="documents/spreadsheet-2025-12-12T19-46-01.is"). The workbook ID is the directory name, not a UUID.]`;
            const start = this.toolStartTimes.get(stepId) || Date.now();
            this.emitActivity({
              kind: "tool_end",
              stepId,
              toolName,
              serverName,
              ok: true,
              durationMs: Date.now() - start,
            });
            return final;
          }

          const start = this.toolStartTimes.get(stepId) || Date.now();
          this.emitActivity({
            kind: "tool_end",
            stepId,
            toolName,
            serverName,
            ok: true,
            durationMs: Date.now() - start,
          });
          
          // Handle different response formats
          if (result?.result) {
            return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
          }
          if (result?.content) {
            return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
          }
          if (typeof result === 'string') {
            return result;
          }
          return JSON.stringify(result);
        } else {
          // Tool execution failed
          const errorMsg = result.error?.message || 'Unknown execution error';
          console.error(`[LLM] Error executing tool ${toolName}:`, errorMsg);
          const start = this.toolStartTimes.get(stepId) || Date.now();
          this.emitActivity({
            kind: "tool_end",
            stepId,
            toolName,
            serverName,
            ok: false,
            durationMs: Date.now() - start,
            error: errorMsg,
          });
          return `Error executing ${toolName}: ${errorMsg}`;
        }
      } else if (this.mcpService) {
        // Legacy fallback for backward compatibility (should be removed in future)
        console.log(`[LLM] Falling back to direct MCP execution: ${toolName} from ${serverName}`);
        try {
          const result = await this.mcpService.sendRequest(
            serverName,
            "tools/call",
            { name: toolName, arguments: args },
            60000 // 60 second timeout for tool execution
          );

          // Handle rag_search_content specially for file tracking
          if (toolName === "rag_search_content" && result?.content) {
            const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
            // Parse RAG response to track sources
            this.trackFilesFromRAGResponse(content);
            // Add explicit instructions for using read_workbook_file with RAG results
            const final =
              content +
              `\n\n[IMPORTANT: When you need to read a file from the search results above, use read_workbook_file with the exact Workbook ID and Path shown. For example, if you see "Workbook ID: ac1000-main-project" and "Path: documents/spreadsheet-2025-12-12T19-46-01.is", call read_workbook_file(workbookId="ac1000-main-project", filePath="documents/spreadsheet-2025-12-12T19-46-01.is"). The workbook ID is the directory name, not a UUID.]`;
            const start = this.toolStartTimes.get(stepId) || Date.now();
            this.emitActivity({
              kind: "tool_end",
              stepId,
              toolName,
              serverName,
              ok: true,
              durationMs: Date.now() - start,
            });
            return final;
          }

          const start = this.toolStartTimes.get(stepId) || Date.now();
          this.emitActivity({
            kind: "tool_end",
            stepId,
            toolName,
            serverName,
            ok: true,
            durationMs: Date.now() - start,
          });

          // Handle different response formats
          if (result?.result) {
            return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
          }
          if (result?.content) {
            return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
          }
          if (typeof result === 'string') {
            return result;
          }
          return JSON.stringify(result);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[LLM] Error executing MCP tool ${toolName}:`, errorMsg);
          const start = this.toolStartTimes.get(stepId) || Date.now();
          this.emitActivity({
            kind: "tool_end",
            stepId,
            toolName,
            serverName,
            ok: false,
            durationMs: Date.now() - start,
            error: errorMsg,
          });
          return `Error executing ${toolName}: ${errorMsg}`;
        }
      }

      return `Error: No tool execution mechanism available for ${toolName}`;
    } catch (error) {
      try {
        const serverName = this.toolRegistry.getToolServer(toolName) || "unknown";
        const start = this.toolStartTimes.get(stepId) || Date.now();
        this.emitActivity({
          kind: "tool_end",
          stepId,
          toolName,
          serverName,
          ok: false,
          durationMs: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // ignore
      }
      return `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // Debug-only helper (used by deterministic smoke tests): run a tool by name.
  // This intentionally uses the same execution pipeline as normal tool calls.
  public async debugExecuteTool(toolName: string, args: Record<string, any>) {
    return await this.executeTool(toolName, args);
  }

  /**
   * Execute core tools (non-MCP tools)
   */
  private async executeCoreTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<string> {
    const scope = await this.getActiveContextScope();
    const isInScope = (workbookId: string) =>
      !scope.workbookIds || scope.workbookIds.has(workbookId);

    switch (toolName) {
        case "read_workbook": {
          const workbookId = String(args?.id || "").trim();
          if (!workbookId) return "Error: Missing workbook id";
          const wb = await this.workbookService.getWorkbook(workbookId);
          if (!wb) return `Error: Workbook not found (${workbookId})`;
          const out = {
            id: (wb as any).id,
            name: (wb as any).name,
            archived: !!(wb as any).archived,
            folders: Array.isArray((wb as any).folders) ? (wb as any).folders : [],
            documents: Array.isArray((wb as any).documents)
              ? (wb as any).documents
                  .filter((d: any) => !d?.archived)
                  .map((d: any) => ({
                    filename: d.filename,
                    path: d.path,
                    folder: d.folder ?? null,
                  }))
              : [],
          };
          return JSON.stringify(out, null, 2);
        }
        case "read_workbook_file":
          try {
            console.log(`[LLM] read_workbook_file called with:`);
            console.log(`  workbookId: "${args.workbookId}"`);
            console.log(`  filePath: "${args.filePath}"`);
            
            const content = await this.fileService.readDocument(
              args.workbookId,
              args.filePath,
            );

            // Track file for references
            const workbook = await this.workbookService.getWorkbook(args.workbookId);
            if (workbook) {
              const filename = args.filePath.split('/').pop() || args.filePath;
              this.filesReadInCurrentChat.push({
                workbookId: args.workbookId,
                workbookName: workbook.name,
                filePath: args.filePath,
                filename: filename
              });
            }

            return `File content:\n${content}`;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[LLM] Error reading file:`, errorMsg);
            console.error(`[LLM] Parameters used: workbookId="${args.workbookId}", filePath="${args.filePath}"`);
            
            // Provide more helpful error message
            let helpfulMsg = `Error reading file: ${errorMsg}. `;
            if (!args.workbookId || !args.filePath) {
              helpfulMsg += `Missing required parameters. `;
            }
            helpfulMsg += `Make sure you're using the exact Workbook ID and Path from the RAG search results (e.g., workbookId="ac1000-main-project", filePath="documents/spreadsheet-2025-12-12T19-46-01.is").`;
            return helpfulMsg;
          }

        case "list_workbooks":
          const workbooks = await this.workbookService.getWorkbooks();
          const activeWorkbooks = workbooks
            .filter((w) => !w.archived)
            .filter((w) => isInScope(w.id));
          if (activeWorkbooks.length === 0) {
            return "No workbooks found.";
          }
          return activeWorkbooks
            .map((w) => {
              const docList = w.documents
                .filter((d: any) => !d.archived)
                .map((d: any) => `  - ${d.filename}`)
                .join("\n");
              return `Workbook: ${w.name}\nID: ${w.id}\nDocuments:\n${docList || "  (no documents)"}`;
            })
            .join("\n\n") + "\n\nTo read a file, use the workbook ID (not the name) and the file path shown.";

        case "create_file_in_workbook":
          {
          const fileName = String(args.fileName || "");
          const canonicalRel = fileName.startsWith("documents/") ? fileName : `documents/${fileName}`;

          // Prevent "fake execution": for .ipynb written via create_file_in_workbook,
          // strip execution_count + outputs so the only trusted execution path is execute_cell.
          let contentToWrite = String(args.content ?? "");
          if (canonicalRel.toLowerCase().endsWith(".ipynb")) {
            try {
              const nb = JSON.parse(contentToWrite);
              if (Array.isArray(nb?.cells)) {
                nb.cells = nb.cells.map((c: any) => {
                  if (!c || typeof c !== "object") return c;
                  if (c.cell_type === "code") {
                    return {
                      ...c,
                      execution_count: null,
                      outputs: [],
                    };
                  }
                  return c;
                });
              }
              contentToWrite = JSON.stringify(nb);
            } catch {
              // If it's not valid JSON, leave it as-is (fail-soft).
            }
          }

          // IMPORTANT: use FileService so workbook.json stays normalized and the UI can refresh immediately.
          // This also enforces the project data boundary (no traversal/absolute paths).
          await this.fileService.writeDocument(String(args.workbookId || ""), canonicalRel, contentToWrite);

          // Notify renderer(s) so open tabs refresh without requiring close/reopen.
          // Mirrors the canonical behavior from `electron/ipc/files.ts`.
          this.broadcast("insightlm:workbooks:changed", {});
          this.broadcast("insightlm:workbooks:filesChanged", { workbookId: String(args.workbookId || "") });

          return `File "${args.fileName}" created successfully in workbook.`;
          }

        case "create_insight_sheet": {
          const workbookId = String(args.workbookId || "").trim();
          const fileNameRaw = String(args.fileName || "").trim();
          if (!workbookId || !fileNameRaw) {
            return `Error executing create_insight_sheet: missing workbookId or fileName`;
          }

          const canonicalRel = fileNameRaw.startsWith("documents/") ? fileNameRaw : `documents/${fileNameRaw}`;
          const finalRel = canonicalRel.toLowerCase().endsWith(".is") ? canonicalRel : `${canonicalRel}.is`;
          const now = new Date().toISOString();
          const title = String(args.title || "").trim() || finalRel.split("/").pop() || "Insight Sheet";
          const sheetName = String(args.sheetName || "").trim() || "Sheet1";

          const content = JSON.stringify(
            {
              version: "1.0",
              metadata: {
                name: title,
                created_at: now,
                modified_at: now,
                workbook_id: workbookId,
              },
              sheets: [
                {
                  id: "sheet-1",
                  name: sheetName,
                  cells: {},
                  formats: {},
                },
              ],
            },
            null,
            2,
          );

          await this.fileService.writeDocument(workbookId, finalRel, content);
          this.broadcast("insightlm:workbooks:changed", {});
          this.broadcast("insightlm:workbooks:filesChanged", { workbookId });

          return `Insight Sheet "${finalRel}" created successfully in workbook.`;
        }

        case "upsert_insight_sheet_cells": {
          const workbookId = String(args.workbookId || "").trim();
          const filePathRaw = String(args.filePath || "").trim();
          const updates = Array.isArray(args.updates) ? args.updates : [];
          if (!workbookId || !filePathRaw || updates.length === 0) {
            return `Error executing upsert_insight_sheet_cells: missing workbookId/filePath/updates`;
          }

          const canonicalRel = filePathRaw.startsWith("documents/") ? filePathRaw : `documents/${filePathRaw}`;
          const finalRel = canonicalRel.toLowerCase().endsWith(".is") ? canonicalRel : `${canonicalRel}.is`;

          // Read, patch, write (fail-soft if malformed).
          let raw = "";
          try {
            raw = await this.fileService.readDocument(workbookId, finalRel);
          } catch (e) {
            return `Error executing upsert_insight_sheet_cells: could not read ${finalRel}`;
          }

          let json: any;
          try {
            json = JSON.parse(raw);
          } catch {
            return `Error executing upsert_insight_sheet_cells: ${finalRel} is not valid JSON`;
          }

          if (!json || typeof json !== "object" || !Array.isArray(json.sheets)) {
            return `Error executing upsert_insight_sheet_cells: ${finalRel} is not a valid .is (missing sheets[])`;
          }

          const sheetName = String(args.sheetName || "").trim();
          const sheet =
            (sheetName ? json.sheets.find((s: any) => String(s?.name || "") === sheetName) : null) ||
            json.sheets[0];
          if (!sheet || typeof sheet !== "object") {
            return `Error executing upsert_insight_sheet_cells: could not locate target sheet`;
          }

          sheet.cells = sheet.cells && typeof sheet.cells === "object" ? sheet.cells : {};

          const normCell = (c: any) => String(c || "").trim().toUpperCase();
          const isCellRef = (c: string) => /^[A-Z]+[1-9]\d*$/.test(c);
          let applied = 0;

          for (const u of updates) {
            const cell = normCell(u?.cell);
            if (!cell || !isCellRef(cell)) continue;

            const next: any = sheet.cells[cell] && typeof sheet.cells[cell] === "object" ? { ...sheet.cells[cell] } : {};
            if ("value" in u) {
              next.value = (u as any).value;
            } else if (!("value" in next)) {
              // Keep existing value if present; otherwise default null for formula-only updates.
              next.value = next.value ?? null;
            }

            if (typeof u?.formula === "string" && String(u.formula).trim()) {
              const fRaw = String(u.formula).trim();
              next.formula = fRaw.startsWith("=") ? fRaw : `=${fRaw}`;
            }

            sheet.cells[cell] = next;
            applied += 1;
          }

          // Touch modified timestamp (best-effort)
          try {
            json.metadata = json.metadata && typeof json.metadata === "object" ? json.metadata : {};
            json.metadata.modified_at = new Date().toISOString();
          } catch {
            // ignore
          }

          await this.fileService.writeDocument(workbookId, finalRel, JSON.stringify(json, null, 2));
          this.broadcast("insightlm:workbooks:changed", {});
          this.broadcast("insightlm:workbooks:filesChanged", { workbookId });

          return `Updated ${applied} cell(s) in "${finalRel}".`;
        }

        case "search_workbooks":
          const allWorkbooks = await this.workbookService.getWorkbooks();
          const results: string[] = [];
          const query = args.query.toLowerCase();

          for (const wb of allWorkbooks
            .filter((w) => !w.archived)
            .filter((w) => isInScope(w.id))) {
            for (const doc of wb.documents.filter((d: any) => !d.archived)) {
              if (doc.filename.toLowerCase().includes(query)) {
                results.push(`${wb.name}/${doc.filename}`);
              }
            }
          }

          return results.length > 0
            ? `Found ${results.length} file(s):\n${results.map((r) => `- ${r}`).join("\n")}`
            : `No files found matching "${args.query}"`;

        case "list_all_workbook_files":
          const allWb = await this.workbookService.getWorkbooks();
          const fileList: string[] = [];

          for (const wb of allWb
            .filter((w) => !w.archived)
            .filter((w) => isInScope(w.id))) {
            for (const doc of wb.documents.filter((d: any) => !d.archived)) {
              fileList.push(`Workbook: ${wb.name} (ID: ${wb.id})\n  File: ${doc.filename}\n  Path: ${doc.path}`);
            }
          }

          return fileList.length > 0
            ? `All files (${fileList.length} total):\n\n${fileList.join("\n\n")}\n\nTo read a file, use read_workbook_file with the workbook ID and file path.`
            : "No files found in workbooks";

        default:
          return `Unknown tool: ${toolName}`;
    }
  }

  /**
   * Fetch the active context scope (workbook IDs) from the context-manager MCP server.
   * Returns an empty scope if MCP service is unavailable or if no active context is set.
   */
  private async getActiveContextScope(): Promise<{ contextId: string | null; workbookIds: Set<string> | null }> {
    if (this.cachedContextScope) {
      return this.cachedContextScope;
    }

    // Default: no scope (operate across all workbooks)
    const empty = { contextId: null, workbookIds: null as Set<string> | null };

    // Request override: allow callers (e.g., Dashboards) to ignore active context scoping.
    if (this.disableContextScopingForRequest) {
      this.cachedContextScope = empty;
      return this.cachedContextScope;
    }

    // UI override: allow "All workbooks" mode (ignore active context scoping)
    if ((global as any).__insightlmDisableContextScoping === true) {
      this.cachedContextScope = empty;
      return this.cachedContextScope;
    }

    try {
      if (!this.mcpService) {
        this.cachedContextScope = empty;
        return empty;
      }

      // Only scope if the context-manager server is running
      if (!this.mcpService.isServerRunning("context-manager")) {
        this.cachedContextScope = empty;
        return empty;
      }

      const res = await this.mcpService.sendRequest(
        "context-manager",
        "tools/call",
        { name: "get_context_workbooks", arguments: {} },
        2000,
      );

      const contextId = (res && (res.context_id ?? res.contextId)) || null;
      const workbookIdsRaw = (res && (res.workbook_ids ?? res.workbookIds)) || [];

      if (!contextId || !Array.isArray(workbookIdsRaw) || workbookIdsRaw.length === 0) {
        this.cachedContextScope = empty;
        return empty;
      }

      const workbookIds = new Set<string>(workbookIdsRaw.filter((x: any) => typeof x === "string"));
      this.cachedContextScope = { contextId, workbookIds };
      return this.cachedContextScope;
    } catch (e) {
      // If context-manager is down or errors, fall back to unscoped behavior
      this.cachedContextScope = empty;
      return empty;
    }
  }

  private async chatWithToolsOpenAI(messages: LLMMessage[]): Promise<string> {
    console.log(`[LLM] Calling OpenAI with ${this.availableTools.length} tools available`);
    console.log(`[LLM] Tools: ${this.availableTools.map(t => t.name).join(", ")}`);

    // OpenAI requires tool function names to match /^[a-zA-Z0-9_-]+$/
    // Our internal tool names may include ":", ".", "/" (e.g. ipc channels / MCP tools).
    // Adapt names for OpenAI only, and map back when executing tools to keep routing decoupled/fail-soft.
    const openAiToolNameMap = new Map<string, string>(); // openaiSafeName -> originalName
    const usedOpenAiNames = new Set<string>();
    const makeOpenAiSafeToolName = (original: string) => {
      const base = original.replace(/[^a-zA-Z0-9_-]/g, "_");
      let candidate = base.length > 0 ? base : "tool";
      let i = 2;
      while (usedOpenAiNames.has(candidate)) {
        candidate = `${base}_${i++}`;
      }
      usedOpenAiNames.add(candidate);
      openAiToolNameMap.set(candidate, original);
      return candidate;
    };

    const openAiTools = this.availableTools.map((tool) => ({
      ...tool,
      name: makeOpenAiSafeToolName(tool.name),
    }));

    // Ensure system prompt tool names match what OpenAI sees (avoid mismatch with internal names)
    const openAiMessages: LLMMessage[] = messages.map((m) =>
      m.role === "system" ? { ...m, content: this.getSystemPrompt(openAiTools) } : m
    );

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: this.formatMessagesForOpenAI(openAiMessages),
        tools: openAiTools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error: ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as any;
    const choice = data.choices[0];

    // Handle tool calls
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      console.log(`[LLM] Tool calls requested: ${choice.message.tool_calls.length}`);
      const toolResults: LLMMessage[] = [];

      for (const toolCall of choice.message.tool_calls) {
        const openAiToolName = toolCall.function.name;
        const toolName = openAiToolNameMap.get(openAiToolName) || openAiToolName;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        console.log(`[LLM] Executing tool: ${toolName} (OpenAI name: ${openAiToolName})`, toolArgs);
        const result = await this.executeTool(toolName, toolArgs);
        console.log(`[LLM] Tool result length: ${result.length} characters`);

        toolResults.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
          name: openAiToolName,
        });
      }

      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: choice.message.content || "",
        tool_calls: choice.message.tool_calls,
      });

      // Add tool results
      messages.push(...toolResults);

      // Recursively call again with tool results
      return this.chatWithToolsOpenAI(messages);
    }

    return choice.message.content || "";
  }

  private async chatWithToolsClaude(messages: LLMMessage[]): Promise<string> {
    // Claude uses different format - implement similar pattern
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        tools: this.availableTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })),
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "tool" ? "user" : m.role,
            content: m.content,
          })),
        system:
          messages.find((m) => m.role === "system")?.content ||
          this.getSystemPrompt(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API error: ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as any;

    // Handle tool use (Claude's format)
    if (data.content && data.content.some((c: any) => c.type === "tool_use")) {
      const toolResults: LLMMessage[] = [];

      for (const content of data.content) {
        if (content.type === "tool_use") {
          const result = await this.executeTool(content.name, content.input);
          toolResults.push({
            role: "user",
            content: `Tool result for ${content.name}: ${result}`,
          });
        }
      }

      messages.push({
        role: "assistant",
        content: data.content
          .map((c: any) => (c.type === "text" ? c.text : ""))
          .join(""),
      });
      messages.push(...toolResults);

      return this.chatWithToolsClaude(messages);
    }

    return data.content?.[0]?.text || "";
  }

  private async chatWithToolsOllama(messages: LLMMessage[]): Promise<string> {
    // Ollama doesn't support function calling natively, so we'll use a simpler approach
    // Parse the response for tool calls or use a wrapper
    const baseUrl = this.config.baseUrl || "http://localhost:11434";
    const TOOL_INSTRUCTIONS = `\n\nIMPORTANT TOOL RULES:\n- If you need a tool, respond with ONLY ONE valid JSON object and nothing else:\n  {"tool": "tool_name", "args": {...}}\n- Do NOT output multiple JSON objects.\n- Do NOT wrap JSON in markdown fences.\n- After you receive a Tool result, respond with your FINAL answer following the original system instructions (often requires JSON with required fields like "value").`;

    // Preserve caller-provided system prompts (e.g., Dashboard tile schemas) by using the full message history.
    const buildPrompt = (msgs: LLMMessage[]) =>
      msgs
        .map((m) => {
          const role = String(m.role || "user").toUpperCase();
          const content = String(m.content || "");
          return `${role}: ${content}`;
        })
        .join("\n\n");

    const ollamaHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Support Ollama API gateways that require auth (e.g., lmsvr).
    // If apiKey is configured, send it as a Bearer token.
    if (this.config.apiKey && String(this.config.apiKey).trim()) {
      ollamaHeaders.Authorization = `Bearer ${String(this.config.apiKey).trim()}`;
    }

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: ollamaHeaders,
      body: JSON.stringify({
        model: this.config.model,
        prompt: buildPrompt(messages) + TOOL_INSTRUCTIONS,
        stream: false,
        options: {
          // Lower temperature makes tool-call formatting significantly more reliable on smaller local models.
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    let responseText = data.response || "";

    const toolCall = this.extractToolCallFromText(responseText);
    if (toolCall) {
      try {
        const result = await this.executeTool(toolCall.name, toolCall.arguments);

        // Continue conversation with tool result
        messages.push({
          role: "assistant",
          content: responseText,
        });
        messages.push({
          role: "user",
          content: `Tool result for ${toolCall.name}: ${result}\n\nNow provide your FINAL answer.`,
        });

        const finalResponse = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: ollamaHeaders,
          body: JSON.stringify({
            model: this.config.model,
            prompt: buildPrompt(messages),
            stream: false,
            options: {
              temperature: 0.3,
            },
          }),
        });

        const finalData = (await finalResponse.json()) as any;
        return finalData.response || responseText;
      } catch {
        // Fail-soft: if tool execution fails, return original model output.
        return responseText;
      }
    }

    return responseText;
  }

  /**
   * Best-effort extraction of {"tool": "...", "args": {...}} from models that don't support native tool calling.
   * Smaller local models often wrap JSON in markdown fences or add extra prose; we tolerate that here.
   */
  private extractToolCallFromText(text: string): ToolCall | null {
    if (!text || typeof text !== "string") return null;

    const candidates: string[] = [];

    // 1) Prefer fenced JSON blocks if present
    const fence = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fence && fence[1]) candidates.push(fence[1].trim());

    // 2) Otherwise, try to find a balanced JSON object that contains a "tool" key
    const idx = text.indexOf("{");
    if (idx >= 0) {
      const balanced = this.extractFirstBalancedJsonObject(text.slice(idx));
      if (balanced) candidates.push(balanced);
    }

    // 3) Last resort: if the model responded with ONLY JSON but we didn't match above
    candidates.push(text.trim());

    for (const c of candidates) {
      const parsed = this.tryParseJson(c);
      if (!parsed || typeof parsed !== "object") continue;
      const toolName = (parsed as any).tool;
      const args = (parsed as any).args;
      if (typeof toolName !== "string" || !toolName.trim()) continue;
      const toolArgs = args && typeof args === "object" ? args : {};
      return { id: `ollama-${Date.now()}`, name: toolName.trim(), arguments: toolArgs };
    }

    return null;
  }

  private tryParseJson(text: string): any | null {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Extracts the first balanced {...} object from the start of `text`.
   * Returns null if braces don't balance.
   */
  private extractFirstBalancedJsonObject(text: string): string | null {
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        if (inStr) escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return text.slice(0, i + 1);
        }
      }
    }
    return null;
  }

  private formatMessagesForOpenAI(messages: LLMMessage[]): any[] {
    const formatted: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === "tool") {
        // Tool messages must have a tool_call_id
        if (!msg.tool_call_id) {
          console.warn("Skipping tool message without tool_call_id");
          continue;
        }
        // Check if there's a preceding assistant message with tool_calls in the ORIGINAL messages array
        // Look backwards from current position to find the most recent assistant message with tool_calls
        let foundAssistantWithToolCalls = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevMsg = messages[j];
          if (prevMsg.role === "assistant" && prevMsg.tool_calls) {
            // Verify this tool_call_id exists in the assistant's tool_calls
            const toolCallExists = prevMsg.tool_calls.some(
              (tc: any) => tc.id === msg.tool_call_id
            );
            if (toolCallExists) {
              foundAssistantWithToolCalls = true;
              break;
            }
          }
          // Stop if we hit a non-assistant message (user/system) - tool messages must follow their assistant message
          if (prevMsg.role !== "assistant" && prevMsg.role !== "tool") {
            break;
          }
        }

        if (!foundAssistantWithToolCalls) {
          console.warn(`Tool message without preceding assistant message with matching tool_calls for tool_call_id: ${msg.tool_call_id}, skipping`);
          continue;
        }

        formatted.push({
          role: "tool",
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        });
      } else if (msg.role === "assistant" && msg.tool_calls) {
        formatted.push({
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.tool_calls,
        });
      } else {
        // Regular user, assistant, or system message
        formatted.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return formatted;
  }
}
