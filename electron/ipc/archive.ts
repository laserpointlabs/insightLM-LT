import { ipcMain } from "electron";
import { ArchiveService } from "../services/archiveService";
import { getWorkbookService } from "./workbooks";

let archiveService: ArchiveService;

export function setupArchiveIPC(configService: any) {
  archiveService = new ArchiveService(getWorkbookService());
  const appConfig = configService.loadAppConfig();
  archiveService.initialize(appConfig.dataDir);

  ipcMain.handle("archive:workbook", async (_, workbookId: string) => {
    try {
      await archiveService.archiveWorkbook(workbookId);
    } catch (error) {
      console.error("Error archiving workbook:", error);
      throw error;
    }
  });

  ipcMain.handle("archive:unarchiveWorkbook", async (_, workbookId: string) => {
    try {
      await archiveService.unarchiveWorkbook(workbookId);
    } catch (error) {
      console.error("Error unarchiving workbook:", error);
      throw error;
    }
  });

  ipcMain.handle(
    "archive:file",
    async (_, workbookId: string, relativePath: string) => {
      try {
        await archiveService.archiveFile(workbookId, relativePath);
      } catch (error) {
        console.error("Error archiving file:", error);
        throw error;
      }
    },
  );

  ipcMain.handle(
    "archive:unarchiveFile",
    async (_, workbookId: string, filename: string) => {
      try {
        await archiveService.unarchiveFile(workbookId, filename);
      } catch (error) {
        console.error("Error unarchiving file:", error);
        throw error;
      }
    },
  );
}
