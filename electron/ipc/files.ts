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

  ipcMain.handle(
    "file:write",
    async (
      _,
      workbookId: string,
      relativePath: string,
      content: string,
    ) => {
      try {
        await fileService.writeDocument(workbookId, relativePath, content);
      } catch (error) {
        console.error("Error writing file:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "file:getPath",
    async (_, workbookId: string, relativePath: string) => {
      try {
        return fileService.getFilePath(workbookId, relativePath);
      } catch (error) {
        console.error("Error getting file path:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "file:readBinary",
    async (_, workbookId: string, relativePath: string) => {
      try {
        const buffer = fileService.readBinary(workbookId, relativePath);
        // Convert buffer to base64 for transmission
        return buffer.toString("base64");
      } catch (error) {
        console.error("Error reading binary file:", error);
        throw error;
      }
    },
  );
}
