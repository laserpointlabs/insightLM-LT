# JupyterLab Extension Integration - TODO List

## Overview

This document outlines the tasks needed to complete the JupyterLab extension integration, including bundling the MCP server with the extension, implementing enable/disable functionality, and moving UI contributions (like the notebook creation icon) into the extension.

## Goal

Complete the JupyterLab extension as a self-contained unit that includes:
- UI components (NotebookViewer, etc.)
- MCP server (jupyter-server)
- Extension contributions (toolbar buttons, icons)
- Enable/disable functionality
- Proper extension lifecycle management

---

## Phase 1: MCP Server Bundling

### Task 1.1: Move MCP Server to Extension Directory
- [ ] Create `extensions/jupyterlab/mcp-server/` directory
- [ ] Move `mcp-servers/jupyter-server/` contents to `extensions/jupyterlab/mcp-server/`
- [ ] Update all file paths and references
- [ ] Verify MCP server files are in correct location:
  - [ ] `server.py`
  - [ ] `config.json`
  - [ ] `requirements.txt`

### Task 1.2: Update Extension Manifest
- [ ] Open `src/extensions/jupyter/manifest.ts`
- [ ] Add `mcpServer` declaration to manifest:
  ```typescript
  mcpServer: {
    enabled: true,
    name: "jupyter-server",
    command: "python",
    args: ["mcp-server/server.py"],
    configPath: "mcp-server/config.json"
  }
  ```
- [ ] Update paths to be relative to extension directory
- [ ] Test manifest parsing

### Task 1.3: Update Extension Registry
- [ ] Locate extension registry code
- [ ] Add MCP server discovery logic:
  - [ ] Check if extension has `mcpServer` in manifest
  - [ ] Resolve MCP server path relative to extension directory
  - [ ] Load MCP server configuration
- [ ] Register MCP server with MCP Service using extension ID
- [ ] Test MCP server discovery

### Task 1.4: Update MCP Service
- [ ] Update `electron/services/mcpService.ts`
- [ ] Add method to accept extension-registered MCP servers:
  - [ ] `registerExtensionServer(extensionId, serverConfig)`
- [ ] Update server discovery to check extension-registered servers
- [ ] Map extension ID to MCP server name
- [ ] Test MCP server registration from extension

### Task 1.5: Update IPC Handlers
- [ ] Update `electron/main.ts` IPC handler for `mcp:jupyter:executeCell`
- [ ] Change to use extension ID instead of hardcoded "jupyter-server"
- [ ] Update to: `mcp:extension:call` with extension ID parameter
- [ ] Update preload script to expose new API
- [ ] Test IPC communication

---

## Phase 2: Extension Enable/Disable Functionality

### Task 2.1: Extension State Management
- [ ] Add extension enabled/disabled state storage:
  - [ ] Use localStorage or Electron store
  - [ ] Store per extension ID
- [ ] Create extension state management service
- [ ] Load extension states on app startup
- [ ] Test state persistence

### Task 2.2: Extension Registry Enable/Disable
- [ ] Add `enableExtension(extensionId)` method
- [ ] Add `disableExtension(extensionId)` method
- [ ] Implement enable flow:
  - [ ] Load extension manifest
  - [ ] Load UI components
  - [ ] Start MCP server (if declared)
  - [ ] Register file handlers
  - [ ] Register contributions
- [ ] Implement disable flow:
  - [ ] Stop MCP server
  - [ ] Unregister file handlers
  - [ ] Unregister contributions
  - [ ] Unload UI components
- [ ] Test enable/disable functionality

### Task 2.3: Extension Manager UI
- [ ] Create Extension Manager component
- [ ] Display list of all extensions:
  - [ ] Extension name and description
  - [ ] Enabled/disabled status
  - [ ] Version information
- [ ] Add toggle switch for each extension
- [ ] Show loading state during enable/disable
- [ ] Display error messages if enable/disable fails
- [ ] Add to Settings or create dedicated Extensions view

### Task 2.4: Update Extension Loading
- [ ] Update extension registry to check enabled state
- [ ] Only load enabled extensions on startup
- [ ] Skip disabled extensions
- [ ] Test that disabled extensions don't load

---

## Phase 3: Move UI Contributions to Extension

### Task 3.1: Move Notebook Creation Icon
- [ ] Locate notebook creation icon in `WorkbooksView.tsx`
- [ ] Create handler in JupyterLab extension:
  - [ ] `src/extensions/jupyter/handlers/createNotebook.ts`
- [ ] Move notebook creation logic to extension handler
- [ ] Add toolbar button contribution to extension manifest
- [ ] Update Extension Registry to render extension contributions
- [ ] Test notebook creation from extension button

### Task 3.2: Extension Contribution System
- [ ] Define contribution types in extension manifest:
  - [ ] `toolbarButtons`
  - [ ] `menuItems`
  - [ ] `contextMenuItems`
- [ ] Create contribution renderer in Extension Registry
- [ ] Render toolbar buttons in appropriate locations
- [ ] Render menu items in context menus
- [ ] Test contribution rendering

### Task 3.3: Update WorkbooksView
- [ ] Remove hardcoded notebook creation icon
- [ ] Make WorkbooksView extension-agnostic
- [ ] Render extension contributions dynamically
- [ ] Test that notebook icon appears from extension
- [ ] Verify icon disappears when extension disabled

---

## Phase 4: Update UI Components to Use Extension API

### Task 4.1: Update NotebookViewer API Calls
- [ ] Update `src/extensions/jupyter/NotebookViewer.tsx`
- [ ] Replace direct MCP calls with extension API:
  - [ ] Change from: `window.electronAPI.mcp.jupyterExecuteCell(...)`
  - [ ] Change to: `window.electronAPI.extensions.call('jupyterlab', 'executeCell', ...)`
- [ ] Update error handling for extension disabled state
- [ ] Test notebook execution

### Task 4.2: Create Extension API in Preload
- [ ] Update `electron/preload.ts`
- [ ] Add `window.electronAPI.extensions` object:
  - [ ] `call(extensionId, method, params)`
  - [ ] `isEnabled(extensionId)`
  - [ ] `getExtensions()`
- [ ] Test API exposure

### Task 4.3: Create Extension IPC Handlers
- [ ] Update `electron/main.ts`
- [ ] Add IPC handler: `extensions:call`
- [ ] Route calls to correct extension's MCP server
- [ ] Handle extension disabled errors
- [ ] Test IPC routing

---

## Phase 5: Testing & Validation

### Task 5.1: Enable/Disable Testing
- [ ] Test enabling JupyterLab extension:
  - [ ] Extension loads
  - [ ] MCP server starts
  - [ ] File handlers register
  - [ ] Toolbar buttons appear
  - [ ] Notebooks can be created
  - [ ] Notebooks can be executed
- [ ] Test disabling JupyterLab extension:
  - [ ] MCP server stops
  - [ ] File handlers unregister
  - [ ] Toolbar buttons disappear
  - [ ] Existing notebooks show error/disabled state
- [ ] Test toggling extension multiple times
- [ ] Test app restart with extension disabled

### Task 5.2: MCP Server Integration Testing
- [ ] Test MCP server starts when extension enabled
- [ ] Test MCP server stops when extension disabled
- [ ] Test MCP server restart on extension re-enable
- [ ] Test MCP server error handling
- [ ] Test MCP server logs and debugging

### Task 5.3: UI Contribution Testing
- [ ] Test notebook creation icon appears when enabled
- [ ] Test notebook creation icon disappears when disabled
- [ ] Test notebook creation works from extension button
- [ ] Test file handler registration (opening .ipynb files)
- [ ] Test file handler unregistration when disabled

### Task 5.4: End-to-End Testing
- [ ] Create new notebook from extension button
- [ ] Write Python code in notebook
- [ ] Execute cell (Ctrl+Enter)
- [ ] Execute cell and move to next (Shift+Enter)
- [ ] View output
- [ ] Disable extension
- [ ] Verify notebook becomes read-only/disabled
- [ ] Re-enable extension
- [ ] Verify notebook works again

---

## Phase 6: Cleanup & Documentation

### Task 6.1: Remove Old MCP Server Location
- [ ] Verify new location works completely
- [ ] Remove `mcp-servers/jupyter-server/` directory
- [ ] Update any remaining references
- [ ] Clean up old config files

### Task 6.2: Update Documentation
- [ ] Update README with extension structure
- [ ] Document extension enable/disable process
- [ ] Document MCP server bundling approach
- [ ] Add code comments for extension system

### Task 6.3: Code Review
- [ ] Review extension manifest structure
- [ ] Review MCP server integration
- [ ] Review enable/disable implementation
- [ ] Review contribution system
- [ ] Check for any hardcoded references

---

## Success Criteria

The JupyterLab extension is complete when:

✅ MCP server is bundled in `extensions/jupyterlab/mcp-server/`
✅ Extension manifest declares MCP server
✅ Extension can be enabled/disabled via UI
✅ MCP server starts/stops with extension lifecycle
✅ Notebook creation icon is part of extension contributions
✅ Notebook creation works from extension button
✅ Notebook execution works via extension MCP server
✅ Extension disabled = notebook functionality unavailable
✅ Extension enabled = notebook functionality available
✅ No hardcoded references to MCP server location
✅ Extension is self-contained and portable

---

## Estimated Time

- **Phase 1 (MCP Server Bundling)**: 2-3 hours
- **Phase 2 (Enable/Disable)**: 2-3 hours
- **Phase 3 (UI Contributions)**: 1-2 hours
- **Phase 4 (Extension API)**: 1-2 hours
- **Phase 5 (Testing)**: 2-3 hours
- **Phase 6 (Cleanup)**: 1 hour

**Total Estimated Time**: 9-14 hours (1-2 days)

---

## Notes

- Start with Phase 1 to get MCP server bundled
- Test after each phase before moving to next
- Keep old MCP server location until new one is fully working
- Document any issues or blockers encountered
- Update this TODO as tasks are completed

---

*Document Version: 1.0*
*Created: 2025-01-15*
*Target Completion: Tomorrow*









