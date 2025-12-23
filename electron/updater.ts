import { autoUpdater } from "electron-updater";
import { app } from "electron";

export function setupUpdater() {
  // Configure auto-updater
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for updates...");
  });

  autoUpdater.on("update-available", (info: any) => {
    console.log("Update available:", info.version);
  });

  autoUpdater.on("update-not-available", (info: any) => {
    console.log("Update not available");
  });

  autoUpdater.on("error", (err: Error) => {
    console.error("Error in auto-updater:", err);
  });

  autoUpdater.on("download-progress", (progressObj: any) => {
    console.log("Download progress:", progressObj.percent);
  });

  autoUpdater.on("update-downloaded", (info: any) => {
    console.log("Update downloaded:", info.version);
    // Prompt user to restart
    // autoUpdater.quitAndInstall()
  });

  // Check for updates on startup
  app.whenReady().then(() => {
    // Wait a bit before checking
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000);
  });
}
