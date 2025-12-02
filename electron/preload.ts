import { contextBridge, ipcRenderer } from "electron";

try {
  contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),

  // Workbook operations
  workbook: {
    create: (name: string) => ipcRenderer.invoke("workbook:create", name),
    getAll: () => ipcRenderer.invoke("workbook:getAll"),
    get: (id: string) => ipcRenderer.invoke("workbook:get", id),
    rename: (id: string, newName: string) =>
      ipcRenderer.invoke("workbook:rename", id, newName),
    delete: (id: string) => ipcRenderer.invoke("workbook:delete", id),
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
  },
});

  console.log("Preload script loaded successfully");
} catch (error) {
  console.error("Failed to load preload script:", error);
}
