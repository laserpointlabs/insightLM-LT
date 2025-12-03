import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { Dashboard } from "../../src/types/dashboard";

export class DashboardService {
  private dashboardsDir: string = "";
  private dashboardsFile: string = "";

  initialize(dataDir: string) {
    this.dashboardsDir = path.join(dataDir, "dashboards");
    this.dashboardsFile = path.join(this.dashboardsDir, "dashboards.json");
    this.ensureDirectoryExists(this.dashboardsDir);
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private loadDashboards(): Dashboard[] {
    if (!fs.existsSync(this.dashboardsFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.dashboardsFile, "utf-8");
      return JSON.parse(content) as Dashboard[];
    } catch (error) {
      console.error("Failed to load dashboards:", error);
      return [];
    }
  }

  private saveDashboards(dashboards: Dashboard[]): void {
    try {
      fs.writeFileSync(
        this.dashboardsFile,
        JSON.stringify(dashboards, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Failed to save dashboards:", error);
      throw error;
    }
  }

  getAllDashboards(): Dashboard[] {
    return this.loadDashboards();
  }

  saveAllDashboards(dashboards: Dashboard[]): void {
    this.saveDashboards(dashboards);
  }

  createDashboard(name: string): Dashboard {
    const dashboards = this.loadDashboards();
    const dashboard: Dashboard = {
      id: uuidv4(),
      name,
      queries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dashboards.push(dashboard);
    this.saveDashboards(dashboards);
    return dashboard;
  }

  updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Dashboard | null {
    const dashboards = this.loadDashboards();
    const index = dashboards.findIndex((d) => d.id === dashboardId);

    if (index === -1) {
      return null;
    }

    dashboards[index] = {
      ...dashboards[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveDashboards(dashboards);
    return dashboards[index];
  }

  renameDashboard(dashboardId: string, newName: string): void {
    const dashboards = this.loadDashboards();
    const index = dashboards.findIndex((d) => d.id === dashboardId);

    if (index === -1) {
      throw new Error(`Dashboard not found: ${dashboardId}`);
    }

    dashboards[index] = {
      ...dashboards[index],
      name: newName,
      updatedAt: new Date().toISOString(),
    };

    this.saveDashboards(dashboards);
  }

  deleteDashboard(dashboardId: string): void {
    const dashboards = this.loadDashboards();
    const filtered = dashboards.filter((d) => d.id !== dashboardId);
    this.saveDashboards(filtered);
  }
}
