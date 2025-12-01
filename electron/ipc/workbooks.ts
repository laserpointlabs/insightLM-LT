import { ipcMain } from "electron";
import { WorkbookService } from "../services/workbookService";

let workbookService: WorkbookService;

export function setupWorkbookIPC(configService: any) {
  workbookService = new WorkbookService();
  const appConfig = configService.loadAppConfig();
  workbookService.initialize(appConfig.dataDir);

  ipcMain.handle("workbook:create", async (_, name: string) => {
    return workbookService.createWorkbook(name);
  });

  ipcMain.handle("workbook:getAll", async () => {
    try {
      const workbooks = workbookService.getWorkbooks();
      return Array.isArray(workbooks) ? workbooks : [];
    } catch (error) {
      console.error("Error getting workbooks:", error);
      return [];
    }
  });

  ipcMain.handle("workbook:get", async (_, id: string) => {
    return workbookService.getWorkbook(id);
  });

  ipcMain.handle("workbook:rename", async (_, id: string, newName: string) => {
    workbookService.renameWorkbook(id, newName);
  });

  ipcMain.handle("workbook:delete", async (_, id: string) => {
    workbookService.deleteWorkbook(id);
  });
}

export function getWorkbookService(): WorkbookService {
  return workbookService;
}
