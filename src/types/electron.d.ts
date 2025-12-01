export interface ElectronAPI {
  getVersion: () => Promise<string>;
  workbook: {
    create: (name: string) => Promise<any>;
    getAll: () => Promise<any[]>;
    get: (id: string) => Promise<any | null>;
    rename: (id: string, newName: string) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  file: {
    add: (
      workbookId: string,
      sourcePath: string,
      filename?: string,
    ) => Promise<void>;
    read: (workbookId: string, relativePath: string) => Promise<string>;
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
