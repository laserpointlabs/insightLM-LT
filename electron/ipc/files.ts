import { ipcMain } from "electron";
import { FileService } from "../services/fileService";
import { getWorkbookService } from "./workbooks";

let fileService: FileService;

export function setupFileIPC() {
  fileService = new FileService(getWorkbookService());

  ipcMain.handle(
    "file:add",
    async (_, workbookId: string, sourcePath: string, filename?: string) => {
      try {
        await fileService.addDocument(workbookId, sourcePath, filename);
      } catch (error) {
        console.error("Error adding file:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "file:read",
    async (_, workbookId: string, relativePath: string) => {
      try {
        return await fileService.readDocument(workbookId, relativePath);
      } catch (error) {
        console.error("Error reading file:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "file:rename",
    async (_, workbookId: string, oldPath: string, newName: string) => {
      try {
        await fileService.renameDocument(workbookId, oldPath, newName);
      } catch (error) {
        console.error("Error renaming file:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "file:delete",
    async (_, workbookId: string, relativePath: string) => {
      try {
        await fileService.deleteDocument(workbookId, relativePath);
      } catch (error) {
        console.error("Error deleting file:", error);
        throw error;
      }
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
      try {
        await fileService.moveDocument(
          sourceWorkbookId,
          relativePath,
          targetWorkbookId,
        );
      } catch (error) {
        console.error("Error moving file:", error);
        throw error;
      }
    },
  );
}
