# Electron Framework Guide for Insight LM

## Table of Contents

1. [Electron Basics](#electron-basics)
2. [Your Current Setup](#your-current-setup)
3. [Deployment with electron-builder](#deployment-with-electron-builder)
4. [Auto-Updates](#auto-updates)
5. [Plugin/Extension System](#pluginextension-system)
6. [Key Concepts You Should Know](#key-concepts-you-should-know)

---

## Electron Basics

### What is Electron?

Electron is a framework that lets you build desktop applications using web technologies (HTML, CSS, JavaScript/TypeScript). It combines:

- **Chromium** (the browser engine) - renders your UI
- **Node.js** - provides backend capabilities (file system, network, etc.)

### The Two-Process Model

Electron apps run in **two separate processes**:

#### 1. Main Process (Backend)

- **One instance** per application
- Controls the application lifecycle
- Creates and manages windows
- Has full access to Node.js APIs (file system, OS APIs, etc.)
- **Your file**: `electron/main.ts`

#### 2. Renderer Process (Frontend)

- **One per window** (you can have multiple windows)
- Runs your React/HTML/CSS/JavaScript UI
- **Sandboxed** - cannot directly access Node.js APIs for security
- **Your files**: `src/**/*` (React app)

### Communication Between Processes

Since the processes are isolated, they communicate via **IPC (Inter-Process Communication)**:

```
┌─────────────────┐         IPC          ┌──────────────────┐
│  Renderer       │ ◄──────────────────► │  Main Process    │
│  (React UI)     │   (preload bridge)   │  (Backend)       │
│                 │                       │                  │
│  - No Node.js   │                       │  - Full Node.js  │
│  - Sandboxed    │                       │  - File System   │
└─────────────────┘                       └──────────────────┘
```

**How it works:**

1. **Preload Script** (`electron/preload.ts`): Runs in renderer but has access to both sides. Exposes safe APIs to the renderer.
2. **IPC Handlers** (`electron/ipc/*.ts`): Handle requests from renderer in the main process.
3. **Context Bridge**: Securely exposes APIs from main to renderer.

**Example Flow:**

```typescript
// Renderer (React) wants to create a workbook
window.electronAPI.workbook.create("My Workbook")
  ↓
// Preload forwards via IPC
ipcRenderer.invoke("workbook:create", "My Workbook")
  ↓
// Main process handler receives it
ipcMain.handle("workbook:create", async (event, name) => {
  // Do the actual work (file system, etc.)
  return workbookService.create(name);
})
  ↓
// Response flows back through IPC
```

---

## Your Current Setup

### Architecture Overview

```
insightLM-LT/
├── electron/              # Main process (backend)
│   ├── main.ts           # Entry point - creates windows, initializes services
│   ├── preload.ts        # IPC bridge - exposes APIs to renderer
│   ├── ipc/              # IPC handlers (workbooks, files, dashboards, etc.)
│   ├── services/         # Backend services (workbook, file, LLM, MCP, etc.)
│   └── updater.ts        # Auto-update logic
│
├── src/                  # Renderer process (React frontend)
│   ├── components/       # UI components
│   ├── store/           # Zustand state management
│   └── services/        # Frontend services
│
├── config/               # Configuration files (YAML)
├── mcp-servers/          # Pluggable MCP servers (Python subprocesses)
└── electron-builder.json # Build configuration
```

### Key Files Explained

#### `electron/main.ts`

- **Purpose**: Application entry point, window management, service initialization
- **Key responsibilities**:
  - Creates the main window (`createWindow()`)
  - Initializes services (ConfigService, MCPService, LLMService, etc.)
  - Sets up IPC handlers
  - Handles app lifecycle (ready, window-all-closed, etc.)
  - Sets up auto-updater

#### `electron/preload.ts`

- **Purpose**: Secure bridge between renderer and main process
- **Key responsibilities**:
  - Exposes `window.electronAPI` to React code
  - Uses `contextBridge` for security (prevents renderer from accessing Node.js directly)
  - Forwards IPC calls from renderer to main

#### `electron/ipc/*.ts`

- **Purpose**: Handle specific IPC requests from renderer
- **Examples**:
  - `workbooks.ts`: Create, read, update, delete workbooks
  - `files.ts`: File operations within workbooks
  - `dashboards.ts`: Dashboard management

### Development vs Production

**Development Mode:**

- Main process: Runs TypeScript directly (`tsc -p electron && electron .`)
- Renderer: Vite dev server (`http://localhost:5173`)
- Hot reload for React, manual restart for Electron

**Production Mode:**

- Main process: Compiled to JavaScript (`dist-electron/electron/main.js`)
- Renderer: Built static files (`dist/index.html`)
- Packaged into `.exe` installer (Windows) or `.app` (Mac)

---

## Deployment with electron-builder

### What is electron-builder?

`electron-builder` packages your Electron app into installers for Windows, Mac, and Linux. It:

- Bundles your code
- Includes Chromium and Node.js runtime
- Creates installers (`.exe`, `.dmg`, `.deb`, etc.)
- Handles code signing (for distribution)
- Manages auto-update metadata

### Your Current Configuration

**`electron-builder.json`:**

```json
{
  "appId": "com.insightlm.lt", // Unique app identifier
  "productName": "insightLM-LT", // Display name
  "directories": {
    "output": "out" // Where installers go
  },
  "files": [
    // What to include in package
    "dist/**/*", // Built React app
    "dist-electron/**/*", // Compiled Electron code
    "config/**/*", // Config files
    "mcp-servers/**/*", // MCP servers
    "package.json"
  ],
  "win": {
    "target": "nsis", // Windows installer format
    "icon": "build/icon.ico" // App icon
  },
  "nsis": {
    "oneClick": false, // Allow custom installation
    "allowToChangeInstallationDirectory": true
  }
}
```

### Building for Distribution

**Current build command:**

```bash
npm run build
```

This runs:

1. `tsc -p electron` - Compiles TypeScript main process
2. `vite build` - Builds React frontend
3. `electron-builder` - Packages everything into installer

**Output:**

- Windows: `out/insightLM-LT Setup 1.0.0.exe`
- Mac: `out/insightLM-LT-1.0.0.dmg`
- Linux: `out/insightLM-LT-1.0.0.AppImage`

### What Gets Packaged?

When you build, electron-builder:

1. **Bundles your code** into an ASAR archive (like a ZIP, but Electron can read it)
2. **Includes Electron runtime** (~100-150MB)
3. **Includes Node.js** (embedded)
4. **Includes Chromium** (embedded)
5. **Creates installer** that users run

**Result**: A single `.exe` file (~150-200MB) that users can install.

### Distribution Options

**Option 1: Direct Download**

- Host installer on your website
- Users download and install manually
- Simple but no auto-updates

**Option 2: Auto-Update Server** (Recommended)

- Host installer + update metadata on server
- App checks for updates automatically
- Downloads and installs updates in background
- Requires update server (GitHub Releases, S3, custom server)

---

## Auto-Updates

### Current Implementation

You already have basic auto-update setup in `electron/updater.ts`:

```typescript
import { autoUpdater } from "electron-updater";

export function setupUpdater() {
  autoUpdater.checkForUpdatesAndNotify();
  // ... event handlers
}
```

**What it does:**

- Checks for updates on startup
- Downloads updates in background
- Logs progress to console

**What's missing:**

- User-facing UI (progress bar, notifications)
- Restart prompt
- Update server configuration

### How Auto-Updates Work

```
┌─────────────┐
│   Your App  │
└──────┬──────┘
       │ 1. Checks update server
       ▼
┌─────────────┐
│ Update      │  ← Hosts latest.yml + installer
│ Server      │     (GitHub Releases, S3, etc.)
└─────────────┘
       │ 2. Returns version info
       ▼
┌─────────────┐
│   Your App  │
│  Compares   │  ← "Is my version < latest?"
└──────┬──────┘
       │ 3. Downloads update
       ▼
┌─────────────┐
│   Your App  │
│  Installs   │  ← Quits and installs
└─────────────┘
```

### Setting Up Auto-Updates

**Step 1: Configure Update Server**

Add to `electron-builder.json`:

```json
{
  "publish": {
    "provider": "github",
    "owner": "your-username",
    "repo": "insightLM-LT"
  }
}
```

Or for custom server:

```json
{
  "publish": {
    "provider": "generic",
    "url": "https://your-server.com/updates"
  }
}
```

**Step 2: Build and Publish**

```bash
# Build with publish config
electron-builder --publish always

# Or manually upload to server
npm run build
# Then upload out/* to your update server
```

**Step 3: Add Update UI**

Enhance `electron/updater.ts` to show progress and restart prompts.

### Update Server Requirements

Your update server must host:

- `latest.yml` (or `latest-mac.yml`, etc.) - Metadata about latest version
- Installer files (`.exe`, `.dmg`, etc.)

**Example `latest.yml`:**

```yaml
version: 1.0.1
files:
  - url: insightLM-LT-Setup-1.0.1.exe
    sha512: abc123...
    size: 150000000
path: insightLM-LT-Setup-1.0.1.exe
sha512: abc123...
releaseDate: "2024-01-15T10:00:00.000Z"
```

electron-builder generates this automatically when you publish.

---

## Plugin/Extension System

### Current State

You have **MCP servers** which are a form of plugins:

- Located in `mcp-servers/`
- Discovered at startup
- Run as Python subprocesses
- Communicate via MCP protocol

**But**: No plugin system for workbenches, views, or UI extensions yet.

### VS Code's Approach (Reference)

VS Code uses:

1. **Extension Manifest** (`package.json` in extension folder)
   - Defines extension metadata
   - Lists contributions (commands, views, etc.)
2. **Extension Host Process**
   - Runs extensions in isolated process
   - Prevents crashes from affecting main app
3. **Extension API**
   - Exposes safe APIs to extensions
   - Prevents extensions from accessing everything
4. **Contribution Points**
   - `contributes.commands` - Register commands
   - `contributes.views` - Register views
   - `contributes.menus` - Add menu items

### Proposed Architecture for Insight LM

Based on your spec (`insightlm_spec.md`), here's how it should work:

#### 1. Plugin Registry Pattern

```typescript
// electron/services/pluginRegistry.ts
interface PluginManifest {
  name: string;
  version: string;
  workbenches?: WorkbenchDefinition[];
  views?: ViewDefinition[];
  contextProviders?: ContextProviderDefinition[];
  commands?: CommandDefinition[];
}

class PluginRegistry {
  private plugins: Map<string, PluginManifest> = new Map();

  register(plugin: PluginManifest) {
    this.plugins.set(plugin.name, plugin);
  }

  getWorkbenches(): WorkbenchDefinition[] {
    // Collect all workbenches from all plugins
  }

  getViews(workbenchId: string): ViewDefinition[] {
    // Get views for specific workbench
  }
}
```

#### 2. Extension Points

**Workbenches:**

```typescript
// plugins/documents-workbench/manifest.json
{
  "name": "documents-workbench",
  "version": "1.0.0",
  "workbenches": [{
    "id": "documents",
    "name": "Documents",
    "views": ["workbooks-tree", "chat", "document-viewer"]
  }]
}
```

**Views:**

```typescript
// plugins/dashboard-workbench/manifest.json
{
  "name": "dashboard-workbench",
  "views": [{
    "id": "dashboard-builder",
    "component": "./DashboardBuilder",
    "workbenches": ["dashboard"]
  }]
}
```

**Context Providers:**

```typescript
// plugins/notebook-plugin/manifest.json
{
  "contextProviders": [{
    "id": "notebook-results",
    "name": "Notebook Results",
    "handler": "./NotebookContextProvider"
  }]
}
```

#### 3. Plugin Discovery

**First-Party Plugins** (shipped with app):

```
plugins/
├── documents-workbench/
│   ├── manifest.json
│   └── components/
├── dashboard-workbench/
│   ├── manifest.json
│   └── components/
└── notebook-workbench/
    ├── manifest.json
    └── components/
```

**Third-Party Plugins** (loaded at runtime):

```
%APPDATA%/insightLM-LT/plugins/
├── ontology-workbench/
│   ├── manifest.json
│   └── components/
└── conceptualizer-workbench/
    ├── manifest.json
    └── components/
```

#### 4. Plugin Loading Flow

```
App Startup
    ↓
Discover Plugins (scan directories)
    ↓
Load Manifests (read manifest.json)
    ↓
Validate Plugins (check versions, dependencies)
    ↓
Register with PluginRegistry
    ↓
Initialize Plugins (load components, register handlers)
    ↓
Render UI (workbenches, views appear)
```

#### 5. Communication Between Plugins

**Pub/Sub Event Bus:**

```typescript
// electron/services/eventBus.ts
class EventBus {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, handler: Function) {
    // Subscribe to event
  }

  emit(event: string, data: any) {
    // Publish event
  }
}

// Plugin A emits event
eventBus.emit("workbook:created", { id: "123" });

// Plugin B listens
eventBus.on("workbook:created", (data) => {
  // React to workbook creation
});
```

**Isolated State:**

- Each plugin has its own state store
- Plugins communicate via events, not shared state
- Data Workbench handles integration between plugins

### Implementation Steps

1. **Create Plugin Registry Service**

   - `electron/services/pluginRegistry.ts`
   - Manages plugin discovery, loading, registration

2. **Define Plugin Manifest Schema**

   - TypeScript interfaces for plugin definitions
   - JSON schema for validation

3. **Create Plugin Loader**

   - Scans plugin directories
   - Loads manifests
   - Validates and registers plugins

4. **Refactor Core Features as Plugins**

   - Convert existing workbenches to plugin format
   - Documents workbench becomes first plugin

5. **Add Plugin UI**

   - Plugin manager view
   - Enable/disable plugins
   - Install third-party plugins

6. **Implement Event Bus**
   - Pub/sub system for plugin communication
   - Replace direct service calls with events

---

## Key Concepts You Should Know

### 1. Context Isolation

**What it is:** Renderer process cannot directly access Node.js APIs.

**Why:** Security - prevents malicious code in your UI from accessing the file system.

**How:** Preload script uses `contextBridge` to expose safe APIs.

**Example:**

```typescript
// ❌ BAD - Direct Node.js access (not allowed)
const fs = require("fs"); // Error: require is not defined

// ✅ GOOD - Through IPC
window.electronAPI.file.read(workbookId, path);
```

### 2. ASAR Archives

**What it is:** Electron packages your code into an ASAR (Atom Shell Archive) file.

**Why:** Faster file access, prevents users from easily modifying your code.

**How:** electron-builder does this automatically.

**Note:** You can read ASAR files like directories, but writing requires extracting.

### 3. Code Signing

**What it is:** Digitally signing your installer so Windows/Mac trust it.

**Why:** Without signing, users get scary warnings ("Unknown publisher").

**How:**

- Windows: Get code signing certificate, add to `electron-builder.json`
- Mac: Apple Developer certificate

**Cost:** ~$100-200/year for certificates.

### 4. Native Modules

**What it is:** Node.js modules with C++ code (like `native-image`).

**Why:** Some modules need native code for performance.

**Gotcha:** Must be compiled for each platform (Windows, Mac, Linux).

**Solution:** Use `electron-rebuild` or ensure modules have prebuilt binaries.

### 5. Process Management

**Main Process:**

- One instance
- Controls app lifecycle
- Can spawn child processes (like your MCP servers)

**Renderer Process:**

- One per window
- Can create multiple windows
- Each is isolated

**Child Processes:**

- Spawned by main process
- Can be Node.js scripts, Python scripts, etc.
- Your MCP servers run as child processes

### 6. Security Best Practices

**✅ DO:**

- Use `contextIsolation: true` (you do this)
- Use `nodeIntegration: false` (you do this)
- Validate all IPC inputs
- Sanitize file paths
- Use HTTPS for network requests

**❌ DON'T:**

- Expose `require` or `process` to renderer
- Trust user input without validation
- Load remote code without verification
- Store secrets in renderer process

### 7. Performance Considerations

**Main Process:**

- Keep it lightweight
- Don't block with long operations
- Use async/await

**Renderer Process:**

- Your React app runs here
- Use React best practices (memo, lazy loading)
- Don't do heavy computation (move to main process)

**IPC:**

- Minimize IPC calls (batching helps)
- Use `invoke` for request/response (you do this)
- Use `send` for one-way messages

### 8. Debugging

**Main Process:**

```bash
# Use console.log (shows in terminal)
console.log("Main process log");

# Or use VS Code debugger
# Add launch.json configuration
```

**Renderer Process:**

```javascript
// DevTools (already enabled in dev mode)
mainWindow.webContents.openDevTools();

// Or use React DevTools
```

**IPC Debugging:**

```typescript
// Log all IPC calls
ipcMain.handle("*", (event, channel, ...args) => {
  console.log(`IPC: ${channel}`, args);
});
```

---

## Next Steps

1. **Improve Auto-Updates**

   - Add update UI (progress bar, notifications)
   - Configure update server (GitHub Releases or custom)
   - Add restart prompt

2. **Implement Plugin System**

   - Create plugin registry service
   - Define plugin manifest schema
   - Refactor core features as plugins
   - Add plugin discovery and loading

3. **Enhance Deployment**

   - Set up code signing (for production)
   - Configure update server
   - Create release workflow (CI/CD)

4. **Documentation**
   - Plugin development guide
   - API documentation for plugin authors
   - Deployment guide for releases

---

## Resources

- **Electron Docs**: https://www.electronjs.org/docs
- **electron-builder Docs**: https://www.electron.build/
- **electron-updater Docs**: https://www.electron.build/auto-update
- **VS Code Extension API**: https://code.visualstudio.com/api (good reference for plugin patterns)

---

## Questions?

Common questions answered:

**Q: Can I use npm packages in the main process?**
A: Yes! Main process has full Node.js access.

**Q: Can I use npm packages in the renderer?**
A: Yes, but they must be browser-compatible (no Node.js APIs).

**Q: How do I add a new IPC handler?**
A: Add handler in `electron/ipc/*.ts`, expose in `preload.ts`, use in React.

**Q: How do I package Python dependencies?**
A: Use `electron-builder` to include Python runtime, or bundle Python scripts and use `child_process.spawn`.

**Q: Can plugins be written in languages other than TypeScript?**
A: Yes, but they need to communicate via IPC or spawn as child processes (like your MCP servers).














