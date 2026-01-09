import { ipcMain } from "electron";
import type { ProjectService } from "../services/projectService";

export function setupProjectsIPC(projectService: ProjectService) {
  ipcMain.handle("project:getCurrent", async () => {
    const dataDir = projectService.getCurrentDataDir();
    return { dataDir, projectId: projectService.getCurrentProjectId() };
  });

  ipcMain.handle("project:listRecents", async () => {
    return { recents: projectService.listRecents() };
  });

  ipcMain.handle("project:open", async (_evt, dataDir: string) => {
    projectService.relaunchIntoProject(String(dataDir || ""));
    return { ok: true };
  });
}

