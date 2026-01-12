import { ipcMain } from "electron";
import type { ProjectStateService, ProjectUIStateV1 } from "../services/projectStateService";

export function setupProjectStateIPC(projectStateService: ProjectStateService) {
  ipcMain.handle("projectState:get", async (): Promise<ProjectUIStateV1> => {
    return projectStateService.get();
  });

  ipcMain.handle("projectState:set", async (_evt, partial: Partial<ProjectUIStateV1>): Promise<ProjectUIStateV1> => {
    return projectStateService.set(partial || {});
  });
}

