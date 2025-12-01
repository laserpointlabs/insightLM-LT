import { ipcMain } from "electron";
import { FileService } from "../services/fileService";
import { getWorkbookService } from "./workbooks";

let fileService: FileService;

export function setupFileIPC() {
  fileService = new FileService(getWorkbookService());

  ipcMain.handle(
    "file:add",
    async (_, workbookId: string, sourcePath: string, filename?: string) => {
      fileService.addDocument(workbookId, sourcePath, filename);
    },
  );

  ipcMain.handle(
    "file:read",
    async (_, workbookId: string, relativePath: string) => {
      return fileService.readDocument(workbookId, relativePath);
    },
  );

  ipcMain.handle(
    "file:rename",
    async (_, workbookId: string, oldPath: string, newName: string) => {
      fileService.renameDocument(workbookId, oldPath, newName);
    },
  );

  ipcMain.handle(
    "file:delete",
    async (_, workbookId: string, relativePath: string) => {
      fileService.deleteDocument(workbookId, relativePath);
    },
  );

  ipcMain.handle(
    "file:move",
    async (
      _,
      sourceWorkbookId: string,
      relativePath: string,
      targetWorkbookId: string,
    ) => {
      fileService.moveDocument(
        sourceWorkbookId,
        relativePath,
        targetWorkbookId,
      );
    },
  );
}
