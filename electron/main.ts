import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import { setupWorkbookIPC } from "./ipc/workbooks";
import { setupFileIPC } from "./ipc/files";
import { setupArchiveIPC } from "./ipc/archive";
import { setupDashboardIPC } from "./ipc/dashboards";
import { setupChatIPC } from "./ipc/chat";
import { setupConfigIPC } from "./ipc/config";
import { setupDemosIPC } from "./ipc/demos";
import { ConfigService } from "./services/configService";
import { MCPService, MCPServerConfig } from "./services/mcpService";
import { LLMService, LLMMessage } from "./services/llmService";
import { DemoService } from "./services/demoService";
import { setupUpdater } from "./updater";
import { seedDemoWorkbooksIfNeeded } from "./services/demoSeedService";

let mainWindow: BrowserWindow | null = null;
let mcpService!: MCPService;
let demoService: DemoService | null = null;

function setAppMenu() {
  const ds = demoService;
  if (!ds) return;

  const demosSubmenu: any[] = [
    {
      label: "AC-1000",
      click: async () => {
        try {
          await ds.loadDemo("ac1000");
        } catch (e) {
          dialog.showErrorBox(
            "Failed to load AC-1000 demo",
            e instanceof Error ? e.message : "Unknown error",
          );
        }
      },
    },
    {
      label: "Trade Study",
      click: async () => {
        try {
          await ds.loadDemo("trade-study");
        } catch (e) {
          dialog.showErrorBox(
            "Failed to load Trade Study demo",
            e instanceof Error ? e.message : "Unknown error",
          );
        }
      },
    },
    { type: "separator" },
    {
      label: "Reset Dev Data…",
      click: async () => {
        try {
          await ds.confirmAndResetDevData();
        } catch (e) {
          dialog.showErrorBox(
            "Failed to reset dev data",
            e instanceof Error ? e.message : "Unknown error",
          );
        }
      },
    },
  ];

  const template: any[] = [];
  if (process.platform === "darwin") {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push({ role: "fileMenu" });
  template.push({ role: "editMenu" });
  template.push({ role: "viewMenu" });
  template.push({ label: "Demos", submenu: demosSubmenu });
  template.push({ role: "windowMenu" });
  template.push({ role: "helpMenu" });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Enable remote debugging in development mode (must be before app.whenReady())
if (process.env.NODE_ENV === "development" || !app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  console.log("Remote debugging enabled on port 9222");
}

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
  // Determine preload path - in dev, __dirname is dist-electron, preload.js is in same directory
  // Allow forcing "prod renderer" locally (load dist/index.html) without packaging via electron-builder.
  // This is useful for running the CDP UI smoke without requiring Windows symlink/admin privileges.
  const forceProdUI = process.env.INSIGHTLM_FORCE_PROD_UI === "1" || process.env.INSIGHTLM_FORCE_PROD_UI === "true";
  const isDev = !forceProdUI && (process.env.NODE_ENV === "development" || !app.isPackaged);
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
    show: true, // Show immediately to debug UI issues
  });

  // Top menu (File/Edit/View/Demos)
  try {
    setAppMenu();
  } catch (e) {
    console.warn("Failed to set app menu:", e);
  }

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

app.whenReady().then(async () => {
  // Setup updater (check for updates on startup)
  if (app.isPackaged) {
    setupUpdater();
  }

  // Initialize config service
  const configService = new ConfigService();
  const appConfig = configService.loadAppConfig();
  const llmConfig = configService.loadLLMConfig();

  // Seed demo workbooks on first run (safe: only when workbooks dir is empty and no seed marker exists).
  // This powers the out-of-box video/demo experience (includes UAV trade study workbook).
  try {
    seedDemoWorkbooksIfNeeded(appConfig.dataDir);
  } catch (e) {
    console.warn("[Seed] Demo workbook seed failed (continuing):", e instanceof Error ? e.message : e);
  }

  // Initialize Tool Registry for dynamic tool discovery
  const { ToolRegistry } = require("./services/toolRegistry");
  const toolRegistry = new ToolRegistry();

  // Initialize Tool Provider Registry (Phase 3: Generic tool execution)
  const { ToolProviderRegistry } = require("./services/toolProviderRegistry");
  const { MCPToolProvider } = require("./services/providers/mcpToolProvider");
  const toolProviderRegistry = new ToolProviderRegistry(toolRegistry);

  // Initialize MCP service (non-blocking)
  try {
    mcpService = new MCPService(path.join(process.cwd(), "mcp-servers"));

    // Wire MCP service to tool registry for dynamic tool discovery
    mcpService.setToolDiscoveryCallback((serverName, tools) => {
      console.log(`[Main] Tools discovered from ${serverName}: ${tools.length} tools`);
      toolRegistry.registerTools(serverName, tools);
    });

    // Wire MCP service to tool registry for tool cleanup on server stop
    mcpService.setServerStopCallback((serverName) => {
      console.log(`[Main] Server ${serverName} stopped, unregistering tools`);
      console.log(`[Main] ToolRegistry instance:`, toolRegistry ? 'exists' : 'missing');
      console.log(`[Main] Calling unregisterTools for ${serverName}`);
      toolRegistry.unregisterTools(serverName);
      console.log(`[Main] unregisterTools call completed for ${serverName}`);
    });

    // Mark extension-managed servers (will be populated by extensions)
    // jupyter-server is managed by jupyter extension
    mcpService.markExtensionManaged("jupyter-server");

    const mcpServers = mcpService.discoverServers();

    // Initialize Tool Provider Registry
    await toolProviderRegistry.initialize();

    // Register MCP Tool Provider
    const mcpProvider = new MCPToolProvider(
      "mcp-provider",
      mcpService,
      toolRegistry,
      mcpServers, // All discovered MCP servers
      100 // Priority
    );
    await toolProviderRegistry.registerProvider({ provider: mcpProvider });

    for (const serverConfig of mcpServers) {
      // Skip extension-managed servers (they're started by extensions)
      if (mcpService.isExtensionManaged(serverConfig.name)) {
        console.log(`[MCP] Skipping auto-start for ${serverConfig.name} (extension-managed)`);
        continue;
      }

      // Ensure INSIGHTLM_DATA_DIR is set for auto-started servers too
      if (!serverConfig.env) serverConfig.env = {};
      if (!serverConfig.env.INSIGHTLM_DATA_DIR) {
        try {
          const appConfig = configService.loadAppConfig();
          if (appConfig.dataDir) {
            serverConfig.env.INSIGHTLM_DATA_DIR = appConfig.dataDir;
          }
        } catch (e) {
          console.warn("[MCP] Could not load app config to set INSIGHTLM_DATA_DIR:", e);
        }
      }

      const serverPath = path.join(mcpService["serversDir"], serverConfig.name);
      if (fs.existsSync(serverPath)) {
        console.log(`[MCP] Auto-starting server: ${serverConfig.name}`);
        mcpService.startServer(serverConfig, serverPath);
      } else {
        console.warn(`[MCP] Server directory not found: ${serverPath}`);
      }
    }
  } catch (error) {
    console.warn("MCP service initialization failed, continuing without MCP servers:", error);
    // Create a minimal MCP service stub to prevent crashes
    mcpService = {
      isServerRunning: () => false,
      sendRequest: async () => { throw new Error("MCP service not available"); },
      stopAll: () => {},
    } as any;
  }

  // Generic health check for servers that support rag/health endpoint
  const checkServerHealth = async (serverName: string) => {
    try {
      const result = await mcpService.sendRequest(serverName, "rag/health", {}, 10000);
      console.log(`[${serverName}] Health check OK:`, result);
    } catch (err) {
      console.warn(`[${serverName}] Health check FAILED:`, err instanceof Error ? err.message : err);
    }
  };

  // Check health for servers that might support it (non-blocking)
  // Find server that provides rag_search_content tool (workbook-rag)
  setTimeout(() => {
    try {
      const ragServer = toolRegistry.getToolServer("rag_search_content");
      if (ragServer && mcpService.isServerRunning(ragServer)) {
        checkServerHealth(ragServer).catch((err) =>
          console.warn(`[${ragServer}] Health check error (async):`, err instanceof Error ? err.message : err),
        );
      }
    } catch (error) {
      console.warn("Health check setup failed:", error);
    }
  }, 2000); // Wait for tools to be discovered

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
    mcpService, // Pass MCP service for RAG content search (legacy)
    toolRegistry, // Pass tool registry for dynamic tool discovery
    toolProviderRegistry, // Pass tool provider registry for generic execution
  );

  // Context scoping override (renderer-controlled)
  // - false: scope tools/LLM to active context workbooks
  // - true: ignore context scoping (all workbooks)
  (global as any).__insightlmDisableContextScoping = false;

  // Initialize Dashboard Query Service (after LLM service is created)
  const { DashboardQueryService } = require("./services/dashboardService");
  const { DashboardPromptService } = require("./services/dashboardPromptService");
  const dashboardPromptService = new DashboardPromptService();
  const dashboardQueryService = new DashboardQueryService(
    mcpService,
    toolRegistry,
    llmService,
    dashboardPromptService,
    fileServiceForLLM,
  );

  // Setup IPC handlers
  setupWorkbookIPC(configService);
  setupFileIPC(ragIndexService); // Pass RAG service for auto-indexing
  setupArchiveIPC(configService);
  setupDashboardIPC(configService);
  setupConfigIPC(configService, llmService);
  // Chat persistence IPC (single-thread-per-context)
  try {
    const { ChatService } = require("./services/chatService");
    const chatService = new ChatService();
    chatService.initialize(appConfig.dataDir);
    setupChatIPC(chatService);
  } catch (e) {
    console.warn("Chat IPC setup failed:", e);
  }

  // LLM IPC handlers
  // NOTE: second param is optional requestId for renderer-side activity correlation.
  ipcMain.handle("llm:chat", async (evt, messages: any[], requestId?: string) => {
    try {
      const rid = typeof requestId === "string" && requestId.trim() ? requestId.trim() : undefined;
      return await llmService.chat(messages, {
        requestId: rid,
        emitActivity: (activityEvt) => {
          try {
            evt.sender.send("llm:activity", activityEvt);
          } catch {
            // ignore
          }
        },
      });
    } catch (error) {
      console.error("Error in LLM chat:", error);
      throw error;
    }
  });

  ipcMain.handle("llm:listModels", async () => {
    try {
      return { models: await llmService.listModels() };
    } catch (error) {
      // Fail-soft: return structured error so UI can render deterministic message.
      return { models: [], error: error instanceof Error ? error.message : "Failed to list models" };
    }
  });

  // Context scoping IPC (UI toggle)
  ipcMain.handle("context:scoping:getMode", () => {
    const disabled = (global as any).__insightlmDisableContextScoping === true;
    return { mode: disabled ? "all" : "context" };
  });
  ipcMain.handle("context:scoping:setMode", async (_, mode: "all" | "context") => {
    (global as any).__insightlmDisableContextScoping = mode === "all";
    return { mode: (global as any).__insightlmDisableContextScoping ? "all" : "context" };
  });

  // Demos service + IPC
  demoService = new DemoService({
    dataDir: appConfig.dataDir,
    mcpService,
    setScopeMode: (mode) => {
      (global as any).__insightlmDisableContextScoping = mode === "all";
    },
    notifyRenderer: (payload) => {
      try {
        mainWindow?.webContents?.send("demos:changed", payload);
      } catch {
        // ignore
      }
    },
    parentWindow: null,
  });
  setupDemosIPC(demoService);

  // MCP Dashboard IPC handlers - Uses DashboardQueryService
  ipcMain.handle("mcp:dashboard:query", async (_, question: string, tileType: string = "counter") => {
    return await dashboardQueryService.executeQuery({ question, tileType });
  });

  // General MCP call handler
  ipcMain.handle("mcp:call", async (_, serverName: string, method: string, params?: any) => {
    try {
      return await mcpService.sendRequest(serverName, method, params);
    } catch (error) {
      console.error("Error in MCP call:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });

  // Debug: Get tool registry state
  ipcMain.handle("debug:getTools", () => {
    const allTools = toolRegistry.getAllTools();
    const toolsByServer: Record<string, Array<{ name: string; description: string }>> = {};
    
    // Group tools by server
    allTools.forEach((tool: { name: string; description: string }) => {
      const serverName = toolRegistry.getToolServer(tool.name);
      if (serverName) {
        if (!toolsByServer[serverName]) {
          toolsByServer[serverName] = [];
        }
        toolsByServer[serverName].push({
          name: tool.name,
          description: tool.description
        });
      }
    });

    return {
      totalTools: allTools.length,
      toolsByServer,
      allTools: allTools.map((t: { name: string; description: string }) => ({
        name: t.name,
        description: t.description,
        server: toolRegistry.getToolServer(t.name)
      }))
    };
  });

  // Debug: Test unregisterTools directly
  ipcMain.handle("debug:unregisterTools", async (_, serverName: string) => {
    try {
      console.log(`[Debug] Directly calling unregisterTools for ${serverName}`);
      const before = toolRegistry.getAllTools().length;
      toolRegistry.unregisterTools(serverName);
      const after = toolRegistry.getAllTools().length;
      return {
        success: true,
        before,
        after,
        removed: before - after
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });

  // Debug: Stop an MCP server (for testing tool unregistration)
  ipcMain.handle("debug:stopServer", async (_, serverName: string) => {
    try {
      if (!mcpService) {
        throw new Error("MCP service not initialized");
      }
      console.log(`[Debug] Stopping server: ${serverName}`);
      
      // Check if server is running
      const isRunning = mcpService.isServerRunning(serverName);
      console.log(`[Debug] Server ${serverName} is running: ${isRunning}`);
      
      // Get tool count before stopping
      const toolsBefore = toolRegistry.getAllTools();
      const toolsBeforeCount = toolsBefore.filter((t: { name: string }) => toolRegistry.getToolServer(t.name) === serverName).length;
      console.log(`[Debug] Tools before stop: ${toolsBeforeCount}`);
      
      // Manually call unregisterTools to ensure it happens
      console.log(`[Debug] Manually unregistering tools for ${serverName}`);
      toolRegistry.unregisterTools(serverName);
      
      // Also call stopServer to clean up the process
      mcpService.stopServer(serverName);
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get tool count after stopping
      const toolsAfter = toolRegistry.getAllTools();
      const toolsAfterCount = toolsAfter.filter((t: { name: string }) => toolRegistry.getToolServer(t.name) === serverName).length;
      console.log(`[Debug] Tools after stop: ${toolsAfterCount}`);
      
      return { 
        success: true, 
        message: `Server ${serverName} stopped`,
        toolsBefore: toolsBeforeCount,
        toolsAfter: toolsAfterCount,
        unregistered: toolsBeforeCount - toolsAfterCount,
        wasRunning: isRunning
      };
    } catch (error) {
      console.error(`[Debug] Error stopping server ${serverName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  });

  // Jupyter notebook execution handler - Dynamic server discovery
  ipcMain.handle("mcp:jupyter:executeCell", async (_, workbookId: string, notebookPath: string, cellIndex: number, code: string) => {
    try {
      console.log('Executing cell via Jupyter kernel:', { workbookId, notebookPath, cellIndex, codeLength: code.length });

      // Find server that provides execute_cell tool
      const jupyterServer = toolRegistry.getToolServer("execute_cell");
      if (!jupyterServer) {
        throw new Error("No Jupyter server available. Please ensure jupyter-server MCP server is enabled.");
      }

      if (!mcpService.isServerRunning(jupyterServer)) {
        throw new Error(`Jupyter server ${jupyterServer} is not running`);
      }

      // Use the MCP server to execute code
      const result = await mcpService.sendRequest(
        jupyterServer,
        "tools/call",
        {
          name: "execute_cell",
          arguments: {
            code: code,
            kernel_name: "python3"
          }
        }
      );

      console.log('Jupyter execution result:', result);
      return result;
    } catch (error) {
      console.error("Error executing jupyter cell:", error);
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

// Extension lifecycle for MCP servers
ipcMain.handle("extensions:setEnabled", async (_event, extensionId: string, enabled: boolean, server?: {
  name: string;
  description?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  serverPath: string;
}) => {
  try {
    if (!mcpService) {
      throw new Error("MCP service not initialized");
    }

    if (!server) {
      console.warn(`[extensions] No server config provided for ${extensionId}, nothing to ${enabled ? 'start' : 'stop'}`);
      return;
    }

    // Resolve server path
    const serverPath = path.isAbsolute(server.serverPath)
      ? server.serverPath
      : path.join(process.cwd(), server.serverPath);

    // Build MCPServerConfig
    const config: MCPServerConfig = {
      name: server.name,
      description: server.description || "",
      command: server.command,
      args: server.args,
      env: server.env,
      enabled,
    };

    // Ensure INSIGHTLM_DATA_DIR is set if provided by app config
    if (!config.env) config.env = {};
    if (!config.env.INSIGHTLM_DATA_DIR) {
      const configService = new ConfigService();
      const appConfig = configService.loadAppConfig();
      if (appConfig.dataDir) {
        config.env.INSIGHTLM_DATA_DIR = appConfig.dataDir;
      }
    }

    if (enabled) {
      // Mark as extension-managed before starting
      mcpService.markExtensionManaged(config.name);
      mcpService.startServer(config, serverPath);
    } else {
      mcpService.stopServer(config.name);
      // Note: We keep it marked as extension-managed even when disabled
      // so it doesn't auto-start on next discovery
    }
  } catch (err) {
    console.error(`Failed to ${enabled ? 'enable' : 'disable'} extension server for ${extensionId}:`, err);
    throw err;
  }
});
