import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import { setupWorkbookIPC } from "./ipc/workbooks";
import { setupFileIPC } from "./ipc/files";
import { setupArchiveIPC } from "./ipc/archive";
import { ConfigService } from "./services/configService";
import { MCPService } from "./services/mcpService";
import { LLMService } from "./services/llmService";
import { setupUpdater } from "./updater";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Determine preload path - in dev, __dirname is dist-electron, in prod it's the app.asar
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  const preloadPath = path.join(__dirname, "preload.js");

  console.log("Preload path:", preloadPath);
  console.log("Preload exists:", fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "default",
  });

  // Log when the window is ready
  mainWindow.webContents.once("did-finish-load", () => {
    console.log("Window finished loading");
    // Check if electronAPI is available in the renderer
    mainWindow?.webContents.executeJavaScript(`
      console.log("electronAPI available:", typeof window.electronAPI !== 'undefined');
      console.log("electronAPI.workbook available:", typeof window.electronAPI?.workbook !== 'undefined');
    `);
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Setup updater (check for updates on startup)
  if (app.isPackaged) {
    setupUpdater();
  }

  // Initialize config service
  const configService = new ConfigService();
  const appConfig = configService.loadAppConfig();
  const llmConfig = configService.loadLLMConfig();

  // Initialize MCP service
  const mcpService = new MCPService(path.join(process.cwd(), "mcp-servers"));
  const mcpServers = mcpService.discoverServers();
  for (const serverConfig of mcpServers) {
    if (serverConfig.enabled) {
      const serverPath = path.join(
        process.cwd(),
        "mcp-servers",
        serverConfig.name,
      );
      mcpService.startServer(serverConfig, serverPath);
    }
  }

  // Initialize services for LLM (need separate instances)
  const { WorkbookService } = require("./services/workbookService");
  const { FileService } = require("./services/fileService");
  const workbookServiceForLLM = new WorkbookService();
  workbookServiceForLLM.initialize(appConfig.dataDir);
  const fileServiceForLLM = new FileService(workbookServiceForLLM);

  // Initialize LLM service
  const llmService = new LLMService(
    llmConfig,
    workbookServiceForLLM,
    fileServiceForLLM,
  );

  // Setup IPC handlers
  setupWorkbookIPC(configService);
  setupFileIPC();
  setupArchiveIPC(configService);

  // LLM IPC handlers
  ipcMain.handle("llm:chat", async (_, messages: any[]) => {
    return await llmService.chat(messages);
  });

  // File dialog handlers
  ipcMain.handle("dialog:openFile", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("dialog:openFiles", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
    });
    return result.canceled ? [] : result.filePaths;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on("before-quit", () => {
    mcpService.stopAll();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handlers will be added here
ipcMain.handle("app:getVersion", () => {
  return app.getVersion();
});
