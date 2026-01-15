import { contextBridge, ipcRenderer } from "electron";

// Smoke/dev reset behavior:
// In automation runs we intentionally delete workbooks/docs, so restoring persisted tabs can
// immediately try to open now-missing files and spam "file:read not found" errors.
// Keep this logic in preload (before React boots) so it's deterministic.
try {
  const cleanTabs =
    String(process.env.INSIGHTLM_CLEAN_TABS_ON_START || "").toLowerCase() === "1" ||
    String(process.env.INSIGHTLM_CLEAN_TABS_ON_START || "").toLowerCase() === "true";
  // IMPORTANT: `View → Reload` reloads the renderer and re-runs preload. We only want to
  // "clean tabs on start" for a fresh renderer process (smoke/dev determinism), not for
  // an in-app reload where users expect tabs/splits to persist.
  const isFreshRendererProcess = (() => {
    try {
      // `process.uptime()` is per-process and continues across renderer reloads.
      return typeof process?.uptime === "function" ? process.uptime() < 5 : false;
    } catch {
      return false;
    }
  })();
  if (cleanTabs && isFreshRendererProcess) {
    const g: any = globalThis as any;
    g.addEventListener?.("DOMContentLoaded", () => {
      try {
        g.localStorage?.removeItem?.("insightlm.openTabs.v1");
      } catch {
        // ignore
      }
    });
  }
} catch {
  // ignore
}

try {
  contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  app: {
    quit: () => ipcRenderer.invoke("app:quit"),
    quitForAutomation: () => ipcRenderer.invoke("app:quitForAutomation"),
  },

  // Workbook operations
  workbook: {
    create: (name: string) => ipcRenderer.invoke("workbook:create", name),
    createFolder: (workbookId: string, folderName: string) => ipcRenderer.invoke("workbook:createFolder", workbookId, folderName),
    deleteFolder: (workbookId: string, folderName: string) => ipcRenderer.invoke("workbook:deleteFolder", workbookId, folderName),
    renameFolder: (workbookId: string, oldName: string, newName: string) => ipcRenderer.invoke("workbook:renameFolder", workbookId, oldName, newName),
    getAll: () => ipcRenderer.invoke("workbook:getAll"),
    get: (id: string) => ipcRenderer.invoke("workbook:get", id),
    rename: (id: string, newName: string) =>
      ipcRenderer.invoke("workbook:rename", id, newName),
    delete: (id: string) => ipcRenderer.invoke("workbook:delete", id),
  },

  // Dashboard operations
  dashboard: {
    getAll: () => ipcRenderer.invoke("dashboard:getAll"),
    create: (name: string) => ipcRenderer.invoke("dashboard:create", name),
    update: (dashboardId: string, updates: any) =>
      ipcRenderer.invoke("dashboard:update", dashboardId, updates),
    rename: (dashboardId: string, newName: string) =>
      ipcRenderer.invoke("dashboard:rename", dashboardId, newName),
    delete: (dashboardId: string) =>
      ipcRenderer.invoke("dashboard:delete", dashboardId),
    saveAll: (dashboards: any[]) =>
      ipcRenderer.invoke("dashboard:saveAll", dashboards),
  },

  // File operations
  file: {
    add: (workbookId: string, sourcePath: string, filename?: string) =>
      ipcRenderer.invoke("file:add", workbookId, sourcePath, filename),
    read: (workbookId: string, relativePath: string) =>
      ipcRenderer.invoke("file:read", workbookId, relativePath),
    write: (
      workbookId: string,
      relativePath: string,
      content: string,
    ) =>
      ipcRenderer.invoke("file:write", workbookId, relativePath, content),
    rename: (workbookId: string, oldPath: string, newName: string) =>
      ipcRenderer.invoke("file:rename", workbookId, oldPath, newName),
    delete: (workbookId: string, relativePath: string) =>
      ipcRenderer.invoke("file:delete", workbookId, relativePath),
    move: (
      sourceWorkbookId: string,
      relativePath: string,
      targetWorkbookId: string,
    ) =>
      ipcRenderer.invoke(
        "file:move",
        sourceWorkbookId,
        relativePath,
        targetWorkbookId,
      ),
    moveToFolder: (
      sourceWorkbookId: string,
      relativePath: string,
      targetWorkbookId: string,
      targetFolder?: string,
      options?: { overwrite?: boolean; destFilename?: string },
    ) =>
      ipcRenderer.invoke(
        "file:moveToFolder",
        sourceWorkbookId,
        relativePath,
        targetWorkbookId,
        targetFolder,
        options,
      ),
    getPath: (workbookId: string, relativePath: string) =>
      ipcRenderer.invoke("file:getPath", workbookId, relativePath),
    readBinary: (workbookId: string, relativePath: string) =>
      ipcRenderer.invoke("file:readBinary", workbookId, relativePath),
  },

  // App-wide events (main → renderer)
  events: {
    onWorkbooksChanged: (cb: (payload: any) => void) => {
      const handler = (_evt: any, payload: any) => cb(payload);
      ipcRenderer.on("insightlm:workbooks:changed", handler);
      return () => ipcRenderer.removeListener("insightlm:workbooks:changed", handler);
    },
    onWorkbookFilesChanged: (cb: (payload: { workbookId?: string }) => void) => {
      const handler = (_evt: any, payload: any) => cb(payload || {});
      ipcRenderer.on("insightlm:workbooks:filesChanged", handler);
      return () => ipcRenderer.removeListener("insightlm:workbooks:filesChanged", handler);
    },
    onLLMConfigChanged: (cb: (payload: any) => void) => {
      const handler = (_evt: any, payload: any) => cb(payload || {});
      ipcRenderer.on("insightlm:config:llmChanged", handler);
      return () => ipcRenderer.removeListener("insightlm:config:llmChanged", handler);
    },
  },

  // Archive operations
  archive: {
    workbook: (workbookId: string) =>
      ipcRenderer.invoke("archive:workbook", workbookId),
    unarchiveWorkbook: (workbookId: string) =>
      ipcRenderer.invoke("archive:unarchiveWorkbook", workbookId),
    file: (workbookId: string, relativePath: string) =>
      ipcRenderer.invoke("archive:file", workbookId, relativePath),
    unarchiveFile: (workbookId: string, filename: string) =>
      ipcRenderer.invoke("archive:unarchiveFile", workbookId, filename),
  },

  // Dialog
  dialog: {
    openFile: () => ipcRenderer.invoke("dialog:openFile"),
    openFiles: () => ipcRenderer.invoke("dialog:openFiles"),
  },

  // Projects (workspace-like)
  project: {
    getCurrent: () => ipcRenderer.invoke("project:getCurrent"),
    listRecents: () => ipcRenderer.invoke("project:listRecents"),
    open: (dataDir: string) => ipcRenderer.invoke("project:open", dataDir),
    pick: (kind: "new" | "open") => ipcRenderer.invoke("project:pick", kind),
  },

  // Project-scoped UI state (disk-backed): active tab + scoping mode, etc.
  projectState: {
    get: () => ipcRenderer.invoke("projectState:get"),
    set: (partial: any) => ipcRenderer.invoke("projectState:set", partial),
  },

  // Project-scoped persisted chat drafts (disk-backed, not localStorage-backed).
  chatDrafts: {
    getAll: () => ipcRenderer.invoke("chatDrafts:getAll"),
    setAll: (drafts: any) => ipcRenderer.invoke("chatDrafts:setAll", drafts),
  },

  // Git-lite (local-first, scoped to current Project)
  git: {
    init: () => ipcRenderer.invoke("git:init"),
    status: () => ipcRenderer.invoke("git:status"),
    diff: (args?: { path?: string; staged?: boolean }) => ipcRenderer.invoke("git:diff", args),
    commit: (message: string) => ipcRenderer.invoke("git:commit", message),
    log: (limit?: number) => ipcRenderer.invoke("git:log", limit),
  },

  llm: {
    chat: (messages: any[], requestId?: string) => ipcRenderer.invoke("llm:chat", messages, requestId),
    listModels: () => ipcRenderer.invoke("llm:listModels"),
    onActivity: (cb: (evt: any) => void) => {
      const handler = (_evt: any, payload: any) => cb(payload);
      ipcRenderer.on("llm:activity", handler);
      return () => ipcRenderer.removeListener("llm:activity", handler);
    },
  },

  // Chat persistence (single-thread per active context)
  chat: {
    getThread: (contextId: string) => ipcRenderer.invoke("chat:getThread", contextId),
    append: (params: { contextId: string; role: "user" | "assistant"; content: string; meta?: any }) =>
      ipcRenderer.invoke("chat:append", params),
    clear: (contextId: string) => ipcRenderer.invoke("chat:clear", contextId),
  },

  // Config editing (YAML-backed)
  config: {
    get: () => ipcRenderer.invoke("config:get"),
    updateApp: (updates: any) => ipcRenderer.invoke("config:updateApp", updates),
    updateLLM: (updates: any) => ipcRenderer.invoke("config:updateLLM", updates),
    getLLMRaw: () => ipcRenderer.invoke("config:getLLMRaw"),
    saveLLMRaw: (rawYaml: string) => ipcRenderer.invoke("config:saveLLMRaw", rawYaml),
  },

  mcp: {
    dashboardQuery: (question: string, tileType?: string) =>
      ipcRenderer.invoke("mcp:dashboard:query", question, tileType || "counter"),
    jupyterExecuteCell: (workbookId: string, notebookPath: string, cellIndex: number, code: string) =>
      ipcRenderer.invoke("mcp:jupyter:executeCell", workbookId, notebookPath, cellIndex, code),
    call: (serverName: string, method: string, params?: any) =>
      ipcRenderer.invoke("mcp:call", serverName, method, params),
  },

  // Context scoping (renderer UI toggle)
  contextScope: {
    getMode: () => ipcRenderer.invoke("context:scoping:getMode"),
    setMode: (mode: "all" | "context") => ipcRenderer.invoke("context:scoping:setMode", mode),
  },

  // Demos (native menu + programmatic)
  demos: {
    load: (demoId: "ac1000" | "trade-study") => ipcRenderer.invoke("demos:load", demoId),
    resetDevData: () => ipcRenderer.invoke("demos:resetDevData"),
    onChanged: (cb: (payload: any) => void) => {
      const handler = (_evt: any, payload: any) => cb(payload);
      ipcRenderer.on("demos:changed", handler);
      return () => ipcRenderer.removeListener("demos:changed", handler);
    },
  },

  // Extension lifecycle controls
  extensions: {
    setEnabled: (extensionId: string, enabled: boolean, server?: {
      name: string;
      description?: string;
      command: string;
      args: string[];
      env?: Record<string, string>;
      serverPath: string;
    }) => ipcRenderer.invoke("extensions:setEnabled", extensionId, enabled, server),
  },

  // Debug endpoints
  debug: {
    getTools: () => ipcRenderer.invoke("debug:getTools"),
    getWindowCount: () => ipcRenderer.invoke("debug:getWindowCount"),
    getLastOpenedWindowInfo: () => ipcRenderer.invoke("debug:getLastOpenedWindowInfo"),
    stopServer: (serverName: string) => ipcRenderer.invoke("debug:stopServer", serverName),
    unregisterTools: (serverName: string) => ipcRenderer.invoke("debug:unregisterTools", serverName),
    llmExecuteTool: (toolName: string, args: any) => ipcRenderer.invoke("debug:llm:executeTool", toolName, args),
  },

  window: {
    openTabInNewWindow: (payload: any) => ipcRenderer.invoke("window:openTabInNewWindow", payload),
  },
});

  // Also fan demo changes into DOM events so React components can refresh without explicit wiring.
  ipcRenderer.on("demos:changed", (_evt, payload) => {
    // NOTE: electron TS build doesn't include DOM libs; use globalThis + runtime guards.
    const w: any = globalThis as any;
    if (!w || typeof w.dispatchEvent !== "function") return;

    try {
      if (typeof w.CustomEvent === "function") {
        w.dispatchEvent(new w.CustomEvent("demos:changed", { detail: payload }));
      } else if (typeof w.Event === "function") {
        w.dispatchEvent(new w.Event("demos:changed"));
      }
    } catch {
      // ignore
    }
    try {
      if (typeof w.Event === "function") w.dispatchEvent(new w.Event("workbooks:changed"));
    } catch {
      // ignore
    }
    try {
      if (typeof w.Event === "function") w.dispatchEvent(new w.Event("context:changed"));
    } catch {
      // ignore
    }
    try {
      if (typeof w.Event === "function") w.dispatchEvent(new w.Event("context:scoping"));
    } catch {
      // ignore
    }
  });

  console.log("Preload script loaded successfully");
} catch (error) {
  console.error("Failed to load preload script:", error);
}
