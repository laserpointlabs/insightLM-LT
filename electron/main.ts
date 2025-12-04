import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { setupWorkbookIPC } from "./ipc/workbooks";
import { setupFileIPC } from "./ipc/files";
import { setupArchiveIPC } from "./ipc/archive";
import { setupDashboardIPC } from "./ipc/dashboards";
import { ConfigService } from "./services/configService";
import { MCPService } from "./services/mcpService";
import { LLMService } from "./services/llmService";
import { setupUpdater } from "./updater";

let mainWindow: BrowserWindow | null = null;

// Function to check if a port is available (Vite is running)
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Function to find Vite dev server port
async function findVitePort(): Promise<number> {
  // Try common Vite ports
  const portsToTry = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];

  for (const port of portsToTry) {
    if (await checkPort(port)) {
      console.log(`Found Vite dev server on port ${port}`);
      return port;
    }
  }

  // Default fallback
  console.warn("Could not find Vite dev server, using default port 5173");
  return 5173;
}

async function createWindow() {
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
    show: false, // Don't show until ready
  });

  // Log when the window is ready
  mainWindow.webContents.once("did-finish-load", () => {
    console.log("Window finished loading");
    mainWindow?.show(); // Show window when content is loaded
    // Check if electronAPI is available in the renderer
    mainWindow?.webContents.executeJavaScript(`
      console.log("electronAPI available:", typeof window.electronAPI !== 'undefined');
      console.log("electronAPI.workbook available:", typeof window.electronAPI?.workbook !== 'undefined');
    `);
  });

  // Load the app
  if (isDev) {
    // Wait for Vite to be ready, then load
    try {
      const port = await findVitePort();
      const url = `http://localhost:${port}`;
      console.log(`Loading dev server from ${url}`);
      await mainWindow.loadURL(url);
      mainWindow.webContents.openDevTools();
    } catch (error) {
      console.error("Error finding Vite port:", error);
      // Fallback to default port
      await mainWindow.loadURL("http://localhost:5173");
      mainWindow.webContents.openDevTools();
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    mainWindow.show();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Prevent external links from opening new windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`[Electron] setWindowOpenHandler called with url:`, url);
    // Block workbook:// protocol links from opening externally
    if (url.startsWith('workbook://')) {
      console.log(`[Electron] BLOCKING workbook:// link from opening new window`);
      return { action: 'deny' };
    }
    // Allow other links to open in default browser
    console.log(`[Electron] Allowing link to open:`, url);
    return { action: 'allow' };
  });

  // Intercept navigation to prevent workbook:// links from navigating
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log(`[Electron] will-navigate event fired with url:`, url);
    if (url.startsWith('workbook://')) {
      console.log(`[Electron] PREVENTING navigation to workbook:// link`);
      event.preventDefault();
    }
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

      // For workbook-rag server, ensure OpenAI API key is passed
      if (serverConfig.name === "workbook-rag" && !serverConfig.env?.OPENAI_API_KEY) {
        const llmConfig = configService.loadLLMConfig();
        if (llmConfig.apiKey) {
          serverConfig.env = {
            ...serverConfig.env,
            OPENAI_API_KEY: llmConfig.apiKey,
          };
        }
      }

      mcpService.startServer(serverConfig, serverPath);
    }
  }

  // Initialize services for LLM (need separate instances)
  const { WorkbookService } = require("./services/workbookService");
  const { FileService } = require("./services/fileService");
  const workbookServiceForLLM = new WorkbookService();
  workbookServiceForLLM.initialize(appConfig.dataDir);
  const fileServiceForLLM = new FileService(workbookServiceForLLM);

  // Initialize RAG indexing service
  const { RAGIndexService } = require("./services/ragIndexService");
  const ragIndexService = new RAGIndexService(appConfig.dataDir, configService);

  // Initialize LLM service
  const llmService = new LLMService(
    llmConfig,
    workbookServiceForLLM,
    fileServiceForLLM,
    ragIndexService, // Pass RAG service for LLM integration
    mcpService, // Pass MCP service for RAG content search
  );

  // Setup IPC handlers
  setupWorkbookIPC(configService);
  setupFileIPC(ragIndexService); // Pass RAG service for auto-indexing
  setupArchiveIPC(configService);
  setupDashboardIPC(configService);

  // LLM IPC handlers
  ipcMain.handle("llm:chat", async (_, messages: any[]) => {
    try {
      return await llmService.chat(messages);
    } catch (error) {
      console.error("Error in LLM chat:", error);
      throw error;
    }
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

  createWindow().catch((error) => {
    console.error("Error creating window:", error);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        console.error("Error creating window:", error);
      });
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
