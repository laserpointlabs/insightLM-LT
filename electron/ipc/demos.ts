import { ipcMain } from "electron";
import { DemoService } from "../services/demoService";

export function setupDemosIPC(demoService: DemoService) {
  ipcMain.handle("demos:load", async (_evt, demoId: "ac1000" | "trade-study") => {
    return await demoService.loadDemo(demoId);
  });

  ipcMain.handle("demos:resetDevData", async () => {
    return await demoService.resetDevData();
  });
}
