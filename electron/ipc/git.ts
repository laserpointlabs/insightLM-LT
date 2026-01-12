import { ipcMain } from "electron";
import type { ConfigService } from "../services/configService";
import { GitService } from "../services/gitService";

export function setupGitIPC(configService: ConfigService) {
  const svc = () => new GitService(configService.loadAppConfig().dataDir);

  ipcMain.handle("git:init", async () => {
    return await svc().init();
  });
  ipcMain.handle("git:status", async () => {
    return await svc().status();
  });
  ipcMain.handle("git:diff", async (_evt, args?: { path?: string; staged?: boolean }) => {
    return await svc().diff(args);
  });
  ipcMain.handle("git:commit", async (_evt, message: string) => {
    return await svc().commit(message);
  });
  ipcMain.handle("git:log", async (_evt, limit?: number) => {
    return await svc().log(limit);
  });
}
