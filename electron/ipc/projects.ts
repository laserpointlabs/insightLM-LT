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

  // Renderer-driven project picker (for in-app menus / top bar).
  ipcMain.handle("project:pick", async (_evt, kind: "new" | "open") => {
    try {
      const k = kind === "new" ? "new" : "open";
      const dir = await projectService.pickProjectDirectory(k);
      if (!dir) return { ok: false, cancelled: true };
      // IMPORTANT: reply before relaunching so renderer doesn't hang.
      setTimeout(() => {
        try {
          projectService.relaunchIntoProject(dir).catch(() => {});
        } catch {
          // ignore
        }
      }, 75);
      return { ok: true, dataDir: dir };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed to pick project" };
    }
  });
}
