import { ipcMain } from "electron";
import { WorkbookService } from "../services/workbookService";

let workbookService: WorkbookService;

export function setupWorkbookIPC(configService: any) {
  workbookService = new WorkbookService();
  const appConfig = configService.loadAppConfig();
  workbookService.initialize(appConfig.dataDir);

  ipcMain.handle("workbook:create", async (_, name: string) => {
    try {
      return await workbookService.createWorkbook(name);
    } catch (error) {
      console.error("Error creating workbook:", error);
      throw error;
    }
  });

  ipcMain.handle("workbook:createFolder", async (_, workbookId: string, folderName: string) => {
    try {
      await workbookService.createFolder(workbookId, folderName);
    } catch (error) {
      console.error("Error creating folder:", error);
      throw error;
    }
  });

  ipcMain.handle("workbook:deleteFolder", async (_, workbookId: string, folderName: string) => {
    try {
      await workbookService.deleteFolder(workbookId, folderName);
    } catch (error) {
      console.error("Error deleting folder:", error);
      throw error;
    }
  });

  ipcMain.handle("workbook:renameFolder", async (_, workbookId: string, oldName: string, newName: string) => {
    try {
      await workbookService.renameFolder(workbookId, oldName, newName);
    } catch (error) {
      console.error("Error renaming folder:", error);
      throw error;
    }
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
    try {
      return await workbookService.getWorkbook(id);
    } catch (error) {
      console.error("Error getting workbook:", error);
      throw error;
    }
  });

  ipcMain.handle("workbook:rename", async (_, id: string, newName: string) => {
    try {
      await workbookService.renameWorkbook(id, newName);
    } catch (error) {
      console.error("Error renaming workbook:", error);
      throw error;
    }
  });

  ipcMain.handle("workbook:delete", async (_, id: string) => {
    try {
      await workbookService.deleteWorkbook(id);
    } catch (error) {
      console.error("Error deleting workbook:", error);
      throw error;
    }
  });
}

export function getWorkbookService(): WorkbookService {
  return workbookService;
}
