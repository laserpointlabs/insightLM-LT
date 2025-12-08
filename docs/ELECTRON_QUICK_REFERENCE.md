# Electron Quick Reference

Quick reference guide for common Electron tasks in Insight LM.

## IPC Communication Flow

```
React Component
    ↓
window.electronAPI.workbook.create("My Workbook")
    ↓
electron/preload.ts (contextBridge)
    ↓
ipcRenderer.invoke("workbook:create", "My Workbook")
    ↓
electron/ipc/workbooks.ts (ipcMain.handle)
    ↓
Backend Service (workbookService.create())
    ↓
Response flows back through IPC
```

## Adding a New Feature (Step-by-Step)

### 1. Add IPC Handler (Main Process)

**File**: `electron/ipc/yourFeature.ts`

```typescript
import { ipcMain } from "electron";

export function setupYourFeatureIPC(service: YourService) {
  ipcMain.handle("yourFeature:action", async (event, param1, param2) => {
    return await service.doAction(param1, param2);
  });
}
```

### 2. Expose in Preload

**File**: `electron/preload.ts`

```typescript
contextBridge.exposeInMainWorld("electronAPI", {
  // ... existing APIs
  yourFeature: {
    action: (param1: string, param2: number) =>
      ipcRenderer.invoke("yourFeature:action", param1, param2),
  },
});
```

### 3. Use in React

**File**: `src/components/YourComponent.tsx`

```typescript
const handleAction = async () => {
  const result = await window.electronAPI.yourFeature.action("param1", 123);
  console.log(result);
};
```

### 4. Register Handler in Main

**File**: `electron/main.ts`

```typescript
import { setupYourFeatureIPC } from "./ipc/yourFeature";

app.whenReady().then(() => {
  // ... other setup
  setupYourFeatureIPC(yourService);
});
```

## Common Patterns

### File Operations

```typescript
// Read file
const content = await window.electronAPI.file.read(workbookId, "path/to/file.txt");

// Write file
await window.electronAPI.file.write(workbookId, "path/to/file.txt", content);

// Get file path (for external tools)
const fullPath = await window.electronAPI.file.getPath(workbookId, "path/to/file.txt");
```

### Dialog Operations

```typescript
// Open file dialog
const result = await window.electronAPI.dialog.openFile();
if (!result.canceled) {
  const filePath = result.filePaths[0];
}

// Open multiple files
const result = await window.electronAPI.dialog.openFiles();
```

### LLM Operations

```typescript
const messages = [
  { role: "user", content: "What is in this document?" }
];
const response = await window.electronAPI.llm.chat(messages);
```

## Development Commands

```bash
# Start development (both Electron and React)
npm run dev

# Build for production
npm run build

# Build Electron only
npm run build:electron

# Build React only
npm run build:react

# Preview React build
npm run preview
```

## File Structure

```
insightLM-LT/
├── electron/              # Main process (backend)
│   ├── main.ts           # Entry point
│   ├── preload.ts        # IPC bridge
│   ├── ipc/              # IPC handlers
│   │   ├── workbooks.ts
│   │   ├── files.ts
│   │   └── dashboards.ts
│   └── services/         # Business logic
│       ├── workbookService.ts
│       ├── fileService.ts
│       └── llmService.ts
│
├── src/                  # Renderer process (React frontend)
│   ├── components/       # UI components
│   ├── store/           # Zustand stores
│   └── services/        # Frontend services
│
├── config/               # Configuration files
├── mcp-servers/          # MCP server plugins
└── electron-builder.json # Build configuration
```

## Debugging

### Main Process Logs
- Check terminal/console where you ran `npm run dev`
- Use `console.log()` in `electron/main.ts` and IPC handlers

### Renderer Process Logs
- Open DevTools: `mainWindow.webContents.openDevTools()`
- Already enabled in dev mode
- Use browser console

### IPC Debugging
Add to `electron/main.ts`:
```typescript
ipcMain.handle("*", (event, channel, ...args) => {
  console.log(`[IPC] ${channel}`, args);
});
```

## Security Checklist

- ✅ `contextIsolation: true` (enabled)
- ✅ `nodeIntegration: false` (enabled)
- ✅ Use `contextBridge` in preload (done)
- ✅ Validate all IPC inputs
- ✅ Sanitize file paths
- ✅ Don't expose `require` or `process` to renderer

## Common Issues

### "require is not defined"
- **Cause**: Trying to use Node.js APIs in renderer
- **Fix**: Use IPC to call main process instead

### "electronAPI is undefined"
- **Cause**: Preload script not loaded
- **Fix**: Check `preload` path in `main.ts`, ensure it's compiled

### IPC handler not working
- **Cause**: Handler not registered or wrong channel name
- **Fix**: Check handler is registered in `main.ts`, verify channel names match

### Build fails
- **Cause**: Missing files or incorrect paths
- **Fix**: Check `electron-builder.json` `files` array includes all needed files

## TypeScript Types

### Window Extension

**File**: `src/types/electron.d.ts`

```typescript
export interface ElectronAPI {
  getVersion: () => Promise<string>;
  workbook: {
    create: (name: string) => Promise<string>;
    getAll: () => Promise<Workbook[]>;
    // ... more methods
  };
  // ... more APIs
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

## Auto-Update Checklist

- [ ] Configure `publish` in `electron-builder.json`
- [ ] Set up update server (GitHub Releases or custom)
- [ ] Add update UI component
- [ ] Test update flow
- [ ] Handle update errors gracefully
- [ ] Add restart prompt

## Plugin System Checklist

- [ ] Create `PluginRegistry` service
- [ ] Define plugin manifest schema
- [ ] Create plugin discovery system
- [ ] Implement event bus for communication
- [ ] Convert core features to plugins
- [ ] Add plugin manager UI
- [ ] Document plugin API

## Resources

- **Electron Docs**: https://www.electronjs.org/docs
- **electron-builder**: https://www.electron.build/
- **electron-updater**: https://www.electron.build/auto-update
- **IPC Guide**: https://www.electronjs.org/docs/latest/tutorial/ipc






