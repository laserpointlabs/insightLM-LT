# Electron Practical Examples

This document provides practical, ready-to-use examples for enhancing your Electron app.

## 1. Enhanced Auto-Updater with UI

### Improved Updater (electron/updater.ts)

```typescript
import { autoUpdater } from "electron-updater";
import { app, BrowserWindow, dialog } from "electron";

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export function setupUpdater(mainWindow: BrowserWindow | null) {
  // Only check for updates in production
  if (!app.isPackaged) {
    console.log("Skipping update check in development mode");
    return;
  }

  // Configure auto-updater
  autoUpdater.autoDownload = false; // Don't auto-download, let user choose
  autoUpdater.autoInstallOnAppQuit = true; // Install when app quits

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for updates...");
    // Send to renderer to show "Checking..." indicator
    mainWindow?.webContents.send("update:checking");
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log("Update available:", info.version);

    // Show dialog to user
    dialog.showMessageBox(mainWindow!, {
      type: "info",
      title: "Update Available",
      message: `A new version (${info.version}) is available.`,
      detail: info.releaseNotes || "Would you like to download it now?",
      buttons: ["Download", "Later"],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        // User clicked "Download"
        autoUpdater.downloadUpdate();
        mainWindow?.webContents.send("update:downloading", {
          version: info.version,
        });
      }
    });
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    console.log("Update not available. Current version:", info.version);
    mainWindow?.webContents.send("update:not-available", {
      version: info.version,
    });
  });

  autoUpdater.on("error", (err: Error) => {
    console.error("Error in auto-updater:", err);
    mainWindow?.webContents.send("update:error", {
      message: err.message,
    });
  });

  autoUpdater.on("download-progress", (progressObj: any) => {
    const percent = Math.round(progressObj.percent);
    console.log(`Download progress: ${percent}%`);

    // Send progress to renderer
    mainWindow?.webContents.send("update:progress", {
      percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    console.log("Update downloaded:", info.version);

    // Show restart prompt
    dialog.showMessageBox(mainWindow!, {
      type: "info",
      title: "Update Ready",
      message: "Update downloaded. Restart now to install?",
      detail: `Version ${info.version} has been downloaded and is ready to install.`,
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        // User clicked "Restart Now"
        autoUpdater.quitAndInstall(false, true); // Don't force quit, but restart
      }
    });

    mainWindow?.webContents.send("update:downloaded", {
      version: info.version,
    });
  });

  // Check for updates on startup (after a delay)
  app.whenReady().then(() => {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 5000); // Wait 5 seconds after app starts
  });

  // Also check periodically (every 4 hours)
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);
}
```

### Update Preload API (add to electron/preload.ts)

```typescript
// Add to contextBridge.exposeInMainWorld("electronAPI", { ... })
update: {
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  onChecking: (callback: () => void) => {
    ipcRenderer.on("update:checking", callback);
    return () => ipcRenderer.removeListener("update:checking", callback);
  },
  onAvailable: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on("update:available", callback);
    return () => ipcRenderer.removeListener("update:available", callback);
  },
  onProgress: (callback: (progress: { percent: number }) => void) => {
    ipcRenderer.on("update:progress", callback);
    return () => ipcRenderer.removeListener("update:progress", callback);
  },
  onDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on("update:downloaded", callback);
    return () => ipcRenderer.removeListener("update:downloaded", callback);
  },
  onError: (callback: (error: { message: string }) => void) => {
    ipcRenderer.on("update:error", callback);
    return () => ipcRenderer.removeListener("update:error", callback);
  },
},
```

### Update IPC Handler (electron/ipc/updates.ts)

```typescript
import { ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

export function setupUpdateIPC() {
  ipcMain.handle("update:check", async () => {
    if (require("electron").app.isPackaged) {
      return autoUpdater.checkForUpdates();
    }
    return null;
  });
}
```

### React Update Component (src/components/UpdateNotification.tsx)

```typescript
import { useEffect, useState } from "react";

interface UpdateState {
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
  version?: string;
  progress?: number;
  error?: string;
}

export function UpdateNotification() {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    if (!window.electronAPI?.update) return;

    const cleanupChecking = window.electronAPI.update.onChecking(() => {
      setUpdateState({ status: "checking" });
    });

    const cleanupAvailable = window.electronAPI.update.onAvailable((info) => {
      setUpdateState({ status: "available", version: info.version });
    });

    const cleanupProgress = window.electronAPI.update.onProgress((progress) => {
      setUpdateState({ status: "downloading", progress: progress.percent });
    });

    const cleanupDownloaded = window.electronAPI.update.onDownloaded((info) => {
      setUpdateState({ status: "downloaded", version: info.version });
    });

    const cleanupError = window.electronAPI.update.onError((error) => {
      setUpdateState({ status: "error", error: error.message });
    });

    return () => {
      cleanupChecking();
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  if (updateState.status === "idle" || updateState.status === "checking") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50">
      {updateState.status === "available" && (
        <div>
          <h3 className="font-semibold text-sm">Update Available</h3>
          <p className="text-xs text-gray-600 mt-1">
            Version {updateState.version} is ready to download.
          </p>
        </div>
      )}

      {updateState.status === "downloading" && (
        <div>
          <h3 className="font-semibold text-sm">Downloading Update</h3>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${updateState.progress || 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {updateState.progress?.toFixed(0)}% complete
          </p>
        </div>
      )}

      {updateState.status === "downloaded" && (
        <div>
          <h3 className="font-semibold text-sm">Update Ready</h3>
          <p className="text-xs text-gray-600 mt-1">
            Restart the app to install version {updateState.version}.
          </p>
        </div>
      )}

      {updateState.status === "error" && (
        <div>
          <h3 className="font-semibold text-sm text-red-600">Update Error</h3>
          <p className="text-xs text-gray-600 mt-1">{updateState.error}</p>
        </div>
      )}
    </div>
  );
}
```

### Update electron-builder.json for GitHub Releases

```json
{
  "publish": {
    "provider": "github",
    "owner": "your-github-username",
    "repo": "insightLM-LT"
  }
}
```

Then build and publish:
```bash
electron-builder --publish always
```

---

## 2. Plugin System Starter

### Plugin Registry Service (electron/services/pluginRegistry.ts)

```typescript
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

export interface WorkbenchDefinition {
  id: string;
  name: string;
  icon?: string;
  views: string[]; // View IDs that belong to this workbench
}

export interface ViewDefinition {
  id: string;
  name: string;
  component: string; // Path to React component
  workbenches: string[]; // Workbench IDs this view belongs to
  icon?: string;
}

export interface ContextProviderDefinition {
  id: string;
  name: string;
  handler: string; // Path to handler function
}

export interface CommandDefinition {
  id: string;
  name: string;
  handler: string; // Path to handler function
  shortcut?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description?: string;
  author?: string;
  workbenches?: WorkbenchDefinition[];
  views?: ViewDefinition[];
  contextProviders?: ContextProviderDefinition[];
  commands?: CommandDefinition[];
  dependencies?: string[]; // Other plugin names this depends on
}

export class PluginRegistry {
  private plugins: Map<string, PluginManifest> = new Map();
  private pluginPaths: Map<string, string> = new Map();

  /**
   * Discover and load all plugins
   */
  async discoverPlugins(): Promise<void> {
    // First-party plugins (shipped with app)
    const firstPartyPath = path.join(__dirname, "../../plugins");
    if (fs.existsSync(firstPartyPath)) {
      await this.loadPluginsFromDirectory(firstPartyPath);
    }

    // Third-party plugins (user-installed)
    const thirdPartyPath = path.join(
      app.getPath("userData"),
      "plugins"
    );
    if (fs.existsSync(thirdPartyPath)) {
      await this.loadPluginsFromDirectory(thirdPartyPath);
    }
  }

  /**
   * Load plugins from a directory
   */
  private async loadPluginsFromDirectory(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(dir, entry.name);
      const manifestPath = path.join(pluginDir, "manifest.json");

      if (!fs.existsSync(manifestPath)) {
        console.warn(`Plugin ${entry.name} missing manifest.json`);
        continue;
      }

      try {
        const manifestContent = fs.readFileSync(manifestPath, "utf-8");
        const manifest: PluginManifest = JSON.parse(manifestContent);

        // Validate required fields
        if (!manifest.name || !manifest.version) {
          console.warn(`Plugin ${entry.name} has invalid manifest`);
          continue;
        }

        // Check dependencies
        if (manifest.dependencies) {
          const missingDeps = manifest.dependencies.filter(
            (dep) => !this.plugins.has(dep)
          );
          if (missingDeps.length > 0) {
            console.warn(
              `Plugin ${manifest.name} missing dependencies: ${missingDeps.join(", ")}`
            );
            continue;
          }
        }

        // Register plugin
        this.plugins.set(manifest.name, manifest);
        this.pluginPaths.set(manifest.name, pluginDir);
        console.log(`Loaded plugin: ${manifest.name} v${manifest.version}`);
      } catch (error) {
        console.error(`Error loading plugin ${entry.name}:`, error);
      }
    }
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin
   */
  getPlugin(name: string): PluginManifest | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all workbenches from all plugins
   */
  getWorkbenches(): WorkbenchDefinition[] {
    const workbenches: WorkbenchDefinition[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.workbenches) {
        workbenches.push(...plugin.workbenches);
      }
    }
    return workbenches;
  }

  /**
   * Get all views for a specific workbench
   */
  getViewsForWorkbench(workbenchId: string): ViewDefinition[] {
    const views: ViewDefinition[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.views) {
        views.push(
          ...plugin.views.filter((view) =>
            view.workbenches.includes(workbenchId)
          )
        );
      }
    }
    return views;
  }

  /**
   * Get all context providers
   */
  getContextProviders(): ContextProviderDefinition[] {
    const providers: ContextProviderDefinition[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.contextProviders) {
        providers.push(...plugin.contextProviders);
      }
    }
    return providers;
  }

  /**
   * Get all commands
   */
  getCommands(): CommandDefinition[] {
    const commands: CommandDefinition[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.commands) {
        commands.push(...plugin.commands);
      }
    }
    return commands;
  }

  /**
   * Get the path to a plugin's directory
   */
  getPluginPath(pluginName: string): string | undefined {
    return this.pluginPaths.get(pluginName);
  }
}
```

### Example Plugin: Documents Workbench (plugins/documents-workbench/manifest.json)

```json
{
  "name": "documents-workbench",
  "version": "1.0.0",
  "displayName": "Documents Workbench",
  "description": "Core workbench for managing documents and workbooks",
  "workbenches": [
    {
      "id": "documents",
      "name": "Documents",
      "icon": "document",
      "views": [
        "workbooks-tree",
        "chat",
        "document-viewer"
      ]
    }
  ],
  "views": [
    {
      "id": "workbooks-tree",
      "name": "Workbooks",
      "component": "./WorkbooksTree",
      "workbenches": ["documents"],
      "icon": "folder"
    },
    {
      "id": "chat",
      "name": "Chat",
      "component": "./Chat",
      "workbenches": ["documents"],
      "icon": "message"
    },
    {
      "id": "document-viewer",
      "name": "Document Viewer",
      "component": "./DocumentViewer",
      "workbenches": ["documents"],
      "icon": "file"
    }
  ]
}
```

### Example Plugin: Dashboard Workbench (plugins/dashboard-workbench/manifest.json)

```json
{
  "name": "dashboard-workbench",
  "version": "1.0.0",
  "displayName": "Dashboard Workbench",
  "description": "Dashboard builder and management",
  "workbenches": [
    {
      "id": "dashboard",
      "name": "Dashboard",
      "icon": "dashboard",
      "views": [
        "dashboard-list",
        "dashboard-builder"
      ]
    }
  ],
  "views": [
    {
      "id": "dashboard-list",
      "name": "Dashboards",
      "component": "./DashboardList",
      "workbenches": ["dashboard"],
      "icon": "list"
    },
    {
      "id": "dashboard-builder",
      "name": "Dashboard Builder",
      "component": "./DashboardBuilder",
      "workbenches": ["dashboard"],
      "icon": "edit"
    }
  ],
  "contextProviders": [
    {
      "id": "dashboard-context",
      "name": "Dashboard Data",
      "handler": "./DashboardContextProvider"
    }
  ]
}
```

### Event Bus for Plugin Communication (electron/services/eventBus.ts)

```typescript
type EventHandler = (data: any) => void;

export class EventBus {
  private listeners: Map<string, EventHandler[]> = new Map();

  /**
   * Subscribe to an event
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit an event
   */
  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  off(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const eventBus = new EventBus();
```

### Usage in Main Process (electron/main.ts)

```typescript
import { PluginRegistry } from "./services/pluginRegistry";
import { eventBus } from "./services/eventBus";

app.whenReady().then(async () => {
  // Initialize plugin registry
  const pluginRegistry = new PluginRegistry();
  await pluginRegistry.discoverPlugins();

  // Get all workbenches
  const workbenches = pluginRegistry.getWorkbenches();
  console.log("Loaded workbenches:", workbenches.map(w => w.name));

  // Example: Listen for workbook creation event
  eventBus.on("workbook:created", (data) => {
    console.log("Workbook created:", data);
    // Notify all plugins that a workbook was created
  });

  // ... rest of initialization
});
```

### React Hook for Plugin System (src/hooks/usePlugins.ts)

```typescript
import { useEffect, useState } from "react";

interface Workbench {
  id: string;
  name: string;
  icon?: string;
}

interface View {
  id: string;
  name: string;
  component: string;
  workbenches: string[];
  icon?: string;
}

export function usePlugins() {
  const [workbenches, setWorkbenches] = useState<Workbench[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load plugins via IPC
    // This would need an IPC handler to get plugin info from main process
    // For now, this is a placeholder
    setLoading(false);
  }, []);

  const getViewsForWorkbench = (workbenchId: string): View[] => {
    return views.filter((view) => view.workbenches.includes(workbenchId));
  };

  return {
    workbenches,
    views,
    getViewsForWorkbench,
    loading,
  };
}
```

---

## 3. Configuration for electron-builder.json

### Complete Configuration Example

```json
{
  "appId": "com.insightlm.lt",
  "productName": "insightLM-LT",
  "directories": {
    "output": "out",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "dist-electron/**/*",
    "config/**/*",
    "mcp-servers/**/*",
    "plugins/**/*",
    "package.json"
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64", "ia32"]
      }
    ],
    "icon": "build/icon.ico",
    "publisherName": "Your Company Name"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "insightLM-LT"
  },
  "mac": {
    "target": "dmg",
    "icon": "build/icon.icns",
    "category": "public.app-category.productivity"
  },
  "linux": {
    "target": "AppImage",
    "icon": "build/icon.png",
    "category": "Office"
  },
  "publish": {
    "provider": "github",
    "owner": "your-github-username",
    "repo": "insightLM-LT"
  }
}
```

---

## Next Steps

1. **Implement Enhanced Updater**: Copy the updater code and integrate it
2. **Set Up Plugin Registry**: Create the plugin registry service
3. **Convert Core Features**: Refactor existing workbenches to plugin format
4. **Add Plugin UI**: Create plugin manager interface
5. **Test Auto-Updates**: Set up GitHub Releases and test update flow







