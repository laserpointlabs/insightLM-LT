export interface ElectronAPI {
  getVersion: () => Promise<string>;
  extensions?: {
    setEnabled: (extensionId: string, enabled: boolean, server?: {
      name: string;
      description?: string;
      command: string;
      args: string[];
      env?: Record<string, string>;
      serverPath: string;
    }) => Promise<void>;
  };
  workbook: {
    create: (name: string) => Promise<any>;
    createFolder: (workbookId: string, folderName: string) => Promise<void>;
    deleteFolder: (workbookId: string, folderName: string) => Promise<void>;
    renameFolder: (workbookId: string, oldName: string, newName: string) => Promise<void>;
    getAll: () => Promise<any[]>;
    get: (id: string) => Promise<any | null>;
    rename: (id: string, newName: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  dashboard: {
    getAll: () => Promise<any[]>;
    create: (name: string) => Promise<any>;
    update: (dashboardId: string, updates: any) => Promise<any>;
    rename: (dashboardId: string, newName: string) => Promise<void>;
    delete: (dashboardId: string) => Promise<void>;
    saveAll: (dashboards: any[]) => Promise<void>;
  };
  file: {
    add: (
      workbookId: string,
      sourcePath: string,
      filename?: string,
    ) => Promise<void>;
    read: (workbookId: string, relativePath: string) => Promise<string>;
    write: (
      workbookId: string,
      relativePath: string,
      content: string,
    ) => Promise<void>;
    rename: (
      workbookId: string,
      oldPath: string,
      newName: string,
    ) => Promise<void>;
    delete: (workbookId: string, relativePath: string) => Promise<void>;
    move: (
      sourceWorkbookId: string,
      relativePath: string,
      targetWorkbookId: string,
    ) => Promise<void>;
    moveToFolder: (
      sourceWorkbookId: string,
      relativePath: string,
      targetWorkbookId: string,
      targetFolder?: string,
      options?: { overwrite?: boolean; destFilename?: string },
    ) => Promise<void>;
    getPath: (workbookId: string, relativePath: string) => Promise<string>;
    readBinary: (workbookId: string, relativePath: string) => Promise<string>;
  };
  archive: {
    workbook: (workbookId: string) => Promise<void>;
    unarchiveWorkbook: (workbookId: string) => Promise<void>;
    file: (workbookId: string, relativePath: string) => Promise<void>;
    unarchiveFile: (workbookId: string, filename: string) => Promise<void>;
  };
  dialog: {
    openFile: () => Promise<string | null>;
    openFiles: () => Promise<string[]>;
  };
  llm: {
    chat: (
      messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }>,
    ) => Promise<string>;
  };
  mcp: {
    call: (serverName: string, method: string, params?: any) => Promise<any>;
    dashboardQuery: (question: string, tileType?: string) => Promise<any>;
    jupyterExecuteCell: (workbookId: string, notebookPath: string, cellIndex: number, code: string) => Promise<any>;
  };
  contextScope?: {
    getMode: () => Promise<{ mode: "all" | "context" }>;
    setMode: (mode: "all" | "context") => Promise<{ mode: "all" | "context" }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
