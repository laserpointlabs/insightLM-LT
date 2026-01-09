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
    // IMPORTANT: reply to the renderer BEFORE relaunching, otherwise the IPC promise can hang
    // (the app may exit before the response is delivered).
    const dir = String(dataDir || "");
    setTimeout(() => {
      try {
        projectService.relaunchIntoProject(dir).catch(() => {});
      } catch {
        // ignore (fail-soft)
      }
    }, 75);
    return { ok: true };
  });
}
