import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export interface Dashboard {
  id: string;
  name: string;
  queries: any[];
  createdAt: string;
  updatedAt: string;
}

export class DashboardStorageService {
  private dashboardsFile: string = "";

  initialize(dataDir: string) {
    const dashboardsDir = path.join(dataDir, "dashboards");
    if (!fs.existsSync(dashboardsDir)) {
      fs.mkdirSync(dashboardsDir, { recursive: true });
    }
    this.dashboardsFile = path.join(dashboardsDir, "dashboards.json");
    this.ensureFileExists();
  }

  private ensureFileExists() {
    if (!fs.existsSync(this.dashboardsFile)) {
      fs.writeFileSync(this.dashboardsFile, JSON.stringify([], null, 2));
    }
  }

  private loadDashboards(): Dashboard[] {
    try {
      const content = fs.readFileSync(this.dashboardsFile, "utf-8");
      return JSON.parse(content) as Dashboard[];
    } catch (error) {
      console.error("Error loading dashboards:", error);
      return [];
    }
  }

  private saveDashboards(dashboards: Dashboard[]) {
    try {
      fs.writeFileSync(this.dashboardsFile, JSON.stringify(dashboards, null, 2));
    } catch (error) {
      console.error("Error saving dashboards:", error);
      throw error;
    }
  }

  getAllDashboards(): Dashboard[] {
    return this.loadDashboards();
  }

  createDashboard(name: string): Dashboard {
    const dashboards = this.loadDashboards();
    const now = new Date().toISOString();
    const dashboard: Dashboard = {
      id: uuidv4(),
      name,
      queries: [],
      createdAt: now,
      updatedAt: now,
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
    if (index !== -1) {
      dashboards[index].name = newName;
      dashboards[index].updatedAt = new Date().toISOString();
      this.saveDashboards(dashboards);
    }
  }

  deleteDashboard(dashboardId: string): void {
    const dashboards = this.loadDashboards();
    const filtered = dashboards.filter((d) => d.id !== dashboardId);
    this.saveDashboards(filtered);
  }

  saveAllDashboards(dashboards: Dashboard[]): void {
    this.saveDashboards(dashboards);
  }
}













