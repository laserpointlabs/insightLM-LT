import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { app, BrowserWindow, dialog } from "electron";
import { expandPath } from "./configService";

type DemoId = "ac1000" | "trade-study";

type MCPServiceLike = {
  isServerRunning: (name: string) => boolean;
  sendRequest: (serverName: string, method: string, params?: any, timeoutMs?: number) => Promise<any>;
};

function getConfigDir(): string {
  const projectConfigDir = path.join(process.cwd(), "config");
  if (fs.existsSync(projectConfigDir)) return projectConfigDir;
  try {
    if (app && app.isPackaged && process.resourcesPath) {
      return path.join(process.resourcesPath, "config");
    }
  } catch {
    // ignore
  }
  return projectConfigDir;
}

function readYamlFile<T = any>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return (yaml.load(raw) as T) ?? null;
  } catch {
    return null;
  }
}

function copyDirRecursive(srcDir: string, destDir: string) {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Demo source not found: ${srcDir}`);
  }

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }

  // Node 16+ supports fs.cpSync; keep a fallback for safety.
  const cp = (fs as any).cpSync as undefined | ((src: string, dest: string, opts: any) => void);
  if (typeof cp === "function") {
    cp(srcDir, destDir, { recursive: true });
    return;
  }

  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDirRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

export class DemoService {
  constructor(
    private readonly params: {
      /** Current app data dir (the one selected by app.yaml) */
      dataDir: string;
      /** Optional MCP service; if present and context-manager is running, we’ll activate context via MCP. */
      mcpService?: MCPServiceLike;
      /** Called to set the global scoping mode (context vs all). */
      setScopeMode?: (mode: "context" | "all") => void;
      /** Used to notify the renderer to refresh views after a demo/reset */
      notifyRenderer?: (payload: any) => void;
      /** Parent window for dialogs */
      parentWindow?: BrowserWindow | null;
    },
  ) {}

  private getOrgDataDir(): string {
    const p = path.join(getConfigDir(), "app.org.yaml");
    const cfg = readYamlFile<{ dataDir?: string }>(p);
    if (cfg?.dataDir && typeof cfg.dataDir === "string" && cfg.dataDir.trim()) {
      // Keep consistent with ConfigService: support %APPDATA% and ${VARS}.
      return expandPath(cfg.dataDir.trim());
    }

    // Fallback: legacy default location (what ConfigService uses when app.yaml is missing).
    const appData =
      process.env.APPDATA ||
      (process.platform === "win32"
        ? path.join(process.env.USERPROFILE || "", "AppData", "Roaming")
        : path.join(process.env.HOME || "", ".config"));
    return path.join(appData, "insightLM-LT");
  }

  private demoSpec(demoId: DemoId): { workbookId: string; contextName: string } {
    if (demoId === "ac1000") {
      // AC-1000 demo includes the core project workbook plus the standard companion workbooks
      // (budget, test schedule, suppliers) so dashboards/chat have richer, realistic content.
      return { workbookId: "ac1000-main-project", contextName: "AC-1000 Demo" };
    }
    return { workbookId: "uav-trade-study", contextName: "Trade Study Demo" };
  }

  private async ensureContextActive(contextName: string, workbookIds: string[]): Promise<string | null> {
    const mcp = this.params.mcpService;
    if (!mcp || !mcp.isServerRunning("context-manager")) return null;

    const wbIds = (Array.isArray(workbookIds) ? workbookIds : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (wbIds.length === 0) return null;

    const listRes = await mcp.sendRequest("context-manager", "tools/call", {
      name: "list_contexts",
      arguments: {},
    });
    const contexts: Array<any> = Array.isArray(listRes?.contexts) ? listRes.contexts : [];
    const existing = contexts.find((c) => String(c?.name || "").trim() === contextName);

    let ctxId: string | null = null;
    if (existing?.id) {
      ctxId = String(existing.id);
      // Keep demo context deterministic: update workbook_ids to exactly what we want.
      await mcp.sendRequest("context-manager", "tools/call", {
        name: "update_context",
        arguments: { context_id: ctxId, updates: { workbook_ids: wbIds, folders: null } },
      });
    } else {
      const created = await mcp.sendRequest("context-manager", "tools/call", {
        name: "create_context",
        arguments: { name: contextName, workbook_ids: wbIds, folders: null },
      });
      ctxId = created?.id ? String(created.id) : null;
    }

    if (ctxId) {
      await mcp.sendRequest("context-manager", "tools/call", {
        name: "activate_context",
        arguments: { context_id: ctxId },
      });
    }

    return ctxId;
  }

  async loadDemo(demoId: DemoId): Promise<{ demoId: DemoId; workbookId: string; contextId: string | null }> {
    const { workbookId, contextName } = this.demoSpec(demoId);
    const workbookIds: string[] =
      demoId === "ac1000"
        ? ["ac1000-main-project", "test-schedule-ac1000", "supplier-agreements", "project-budget"]
        : [workbookId];

    // Copy seed workbook(s) from orgDataDir -> current dataDir
    for (const wid of workbookIds) {
      const src = path.join(this.getOrgDataDir(), "workbooks", wid);
      const dst = path.join(this.params.dataDir, "workbooks", wid);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      // If the "org" demo source is missing but the workbook already exists locally, don't fail.
      // This can happen in dev if demos were seeded directly into the active dataDir.
      if (!fs.existsSync(src)) {
        if (fs.existsSync(dst)) continue;
        throw new Error(
          `Demo source workbook not found.\n\nExpected:\n${src}\n\nTry: Demos → Reset Dev Data… (re-seeds demos)`,
        );
      }
      copyDirRecursive(src, dst);
    }

    // Force scoped mode for demo clarity.
    this.params.setScopeMode?.("context");

    // Activate a deterministic demo context (best-effort)
    let contextId: string | null = null;
    try {
      contextId = await this.ensureContextActive(contextName, workbookIds);
    } catch (e) {
      // Fail-soft: workbook is still loaded; context activation can be done manually if MCP is down.
      console.warn(`[Demos] Failed to activate context via MCP:`, e);
    }

    this.params.notifyRenderer?.({ type: "demo_loaded", demoId, workbookId, contextId });
    return { demoId, workbookId, contextId };
  }

  async resetDevData(): Promise<{ ok: true }> {
    const dataDir = this.params.dataDir;
    // Clear all user-generated content and the demo seed marker so we can re-seed cleanly.
    const toDelete = ["workbooks", "dashboards", "contexts", "chats", "rag_db", ".seed"];
    for (const name of toDelete) {
      const p = path.join(dataDir, name);
      try {
        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
      } catch (e) {
        console.warn(`[Demos] Failed to delete ${p}:`, e);
      }
    }

    // Recreate expected dirs so the UI stays stable (workbooks list calls should return []).
    for (const name of ["workbooks", "dashboards", "contexts", "chats"]) {
      try {
        fs.mkdirSync(path.join(dataDir, name), { recursive: true });
      } catch {
        // ignore
      }
    }

    // Avoid noisy ENOENT reads on first dashboard load.
    try {
      const dashboardsFile = path.join(dataDir, "dashboards", "dashboards.json");
      if (!fs.existsSync(dashboardsFile)) {
        fs.writeFileSync(dashboardsFile, JSON.stringify([], null, 2), "utf-8");
      }
    } catch {
      // ignore
    }

    this.params.setScopeMode?.("context");
    this.params.notifyRenderer?.({ type: "dev_data_reset" });
    return { ok: true };
  }

  async confirmAndResetDevData(): Promise<void> {
    const win = this.params.parentWindow ?? null;
    const show = async (options: any) => {
      return win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    };

    const res = await show({
      type: "warning",
      buttons: ["Cancel", "Reset"],
      defaultId: 0,
      cancelId: 0,
      title: "Reset Dev Data",
      message: "This will delete ALL dev workbooks, dashboards, contexts, chats, and RAG index for the current dataDir.",
      detail: `dataDir:\n${this.params.dataDir}`,
    });
    if (res.response !== 1) return;
    await this.resetDevData();
    await show({
      type: "info",
      buttons: ["OK"],
      title: "Reset Complete",
      message: "Dev data was cleared.",
    });
  }
}
