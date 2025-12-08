import { ipcMain } from "electron";
import { DashboardService } from "../services/dashboardService";

let dashboardService: DashboardService;

export function setupDashboardIPC(configService: any) {
  dashboardService = new DashboardService();
  const appConfig = configService.loadAppConfig();
  dashboardService.initialize(appConfig.dataDir);

  ipcMain.handle("dashboard:getAll", async () => {
    try {
      const dashboards = dashboardService.getAllDashboards();
      return Array.isArray(dashboards) ? dashboards : [];
    } catch (error) {
      console.error("Error getting dashboards:", error);
      return [];
    }
  });

  ipcMain.handle("dashboard:create", async (_, name: string) => {
    try {
      return await dashboardService.createDashboard(name);
    } catch (error) {
      console.error("Error creating dashboard:", error);
      throw error;
    }
  });

  ipcMain.handle("dashboard:update", async (_, dashboardId: string, updates: any) => {
    try {
      return await dashboardService.updateDashboard(dashboardId, updates);
    } catch (error) {
      console.error("Error updating dashboard:", error);
      throw error;
    }
  });

  ipcMain.handle("dashboard:rename", async (_, dashboardId: string, newName: string) => {
    try {
      await dashboardService.renameDashboard(dashboardId, newName);
    } catch (error) {
      console.error("Error renaming dashboard:", error);
      throw error;
    }
  });

  ipcMain.handle("dashboard:delete", async (_, dashboardId: string) => {
    try {
      await dashboardService.deleteDashboard(dashboardId);
    } catch (error) {
      console.error("Error deleting dashboard:", error);
      throw error;
    }
  });

  ipcMain.handle("dashboard:saveAll", async (_, dashboards: any[]) => {
    try {
      dashboardService.saveAllDashboards(dashboards);
    } catch (error) {
      console.error("Error saving all dashboards:", error);
      throw error;
    }
  });
}

export function getDashboardService(): DashboardService {
  return dashboardService;
}
