import { contextBridge, ipcRenderer } from "electron";

try {
  contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),

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

  llm: {
    chat: (messages: any[]) => ipcRenderer.invoke("llm:chat", messages),
    listModels: () => ipcRenderer.invoke("llm:listModels"),
  },

  // Chat persistence (single-thread per active context)
  chat: {
    getThread: (contextId: string) => ipcRenderer.invoke("chat:getThread", contextId),
    append: (params: { contextId: string; role: "user" | "assistant"; content: string }) =>
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
    stopServer: (serverName: string) => ipcRenderer.invoke("debug:stopServer", serverName),
    unregisterTools: (serverName: string) => ipcRenderer.invoke("debug:unregisterTools", serverName),
  },
});

  console.log("Preload script loaded successfully");
} catch (error) {
  console.error("Failed to load preload script:", error);
}
