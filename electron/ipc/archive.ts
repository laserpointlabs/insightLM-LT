import { ipcMain } from "electron";
import { ArchiveService } from "../services/archiveService";
import { getWorkbookService } from "./workbooks";

let archiveService: ArchiveService;

export function setupArchiveIPC(configService: any) {
  archiveService = new ArchiveService(getWorkbookService());
  const appConfig = configService.loadAppConfig();
  archiveService.initialize(appConfig.dataDir);

  ipcMain.handle("archive:workbook", async (_, workbookId: string) => {
    archiveService.archiveWorkbook(workbookId);
  });

  ipcMain.handle("archive:unarchiveWorkbook", async (_, workbookId: string) => {
    archiveService.unarchiveWorkbook(workbookId);
  });

  ipcMain.handle(
    "archive:file",
    async (_, workbookId: string, relativePath: string) => {
      archiveService.archiveFile(workbookId, relativePath);
    },
  );

  ipcMain.handle(
    "archive:unarchiveFile",
    async (_, workbookId: string, filename: string) => {
      archiveService.unarchiveFile(workbookId, filename);
    },
  );
}
