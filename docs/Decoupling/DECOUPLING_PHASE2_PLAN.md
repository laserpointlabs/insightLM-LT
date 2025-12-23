# Phase 2 Decoupling Plan

## Overview

Phase 1 achieved dynamic tool discovery. Phase 2 focuses on:
1. Removing remaining hardcoded server name references
2. Reviewing and standardizing all MCP servers
3. Abstracting remaining coupling points
4. Improving server lifecycle management

## Remaining Coupling Issues

### 1. Hardcoded Server Names in main.ts

**Current Issues:**
- `main.ts` has hardcoded checks for `"jupyter-server"` (line 159)
- `main.ts` has hardcoded checks for `"workbook-rag"` (line 171, 188)
- Dashboard IPC handler hardcodes `"workbook-dashboard"` (lines 242, 275)
- Jupyter IPC handler hardcodes `"jupyter-server"` (line 349)

**Solution:**
- Create server registry/configuration system
- Use server metadata instead of hardcoded names
- Make IPC handlers discover servers dynamically

### 2. Dashboard Flow Coupling

**Current Issue:**
- Dashboard IPC handler (`mcp:dashboard:query`) has hardcoded 3-step flow:
  1. Call `workbook-dashboard` → `create_dashboard_query`
  2. Call LLM with structured prompt
  3. Call `workbook-dashboard` → `format_llm_response`

**Solution:**
- Abstract dashboard flow into a service
- Make it configurable/extensible
- Allow other servers to provide dashboard capabilities

### 3. MCP Server Consistency Review

**Servers to Review:**
- `workbook-rag` ✅ (updated in Phase 1)
- `workbook-dashboard` ✅ (already uses tools/list)
- `jupyter-server` ✅ (already uses tools/list)
- `workbook-manager` ❓ (needs review)
- `document-parser` ❓ (needs review)
- `spreadsheet-server` ❓ (needs review)

**Tasks:**
- Ensure all servers expose tools via `tools/list`
- Standardize initialization messages
- Remove any custom method calls that should be tools

### 4. Server Lifecycle Management

**Current Issues:**
- Tools not unregistered when servers stop
- Extension enable/disable doesn't cleanly manage tool lifecycle
- No graceful degradation when servers fail

**Solution:**
- Hook server stop events to unregister tools
- Improve extension lifecycle integration
- Add error handling and retry logic

## Phase 2 Tasks

### Task 1: Remove Hardcoded Server Names ✅
- [x] Create server metadata/registry system (extension-managed tracking)
- [x] Replace hardcoded `"jupyter-server"` checks (uses `isExtensionManaged()`)
- [x] Replace hardcoded `"workbook-rag"` checks (generic env var expansion, dynamic health check)
- [x] Replace hardcoded `"workbook-dashboard"` checks (dynamic tool discovery)
- [x] Make IPC handlers server-agnostic (dashboard & jupyter use `toolRegistry.getToolServer()`)

### Task 2: Abstract Dashboard Flow ✅
- [x] Create `DashboardQueryService` to manage dashboard queries
- [x] Remove hardcoded dashboard flow from `main.ts`
- [x] Make dashboard capabilities discoverable (uses `toolRegistry.getToolServer()`)
- [x] Allow multiple dashboard providers (dynamic server discovery)
- [x] Separate dashboard CRUD operations into `DashboardStorageService`

### Task 3: Review All MCP Servers ✅
- [x] Audit `workbook-manager` server (updated with tools/list and initialization)
- [x] Audit `document-parser` server (updated with tools/list and initialization)
- [x] Audit `spreadsheet-server` server (updated with tools/list and initialization)
- [x] Ensure all expose tools via `tools/list` (all servers now support it)
- [x] Standardize initialization messages (all servers send init on startup)

### Task 4: Improve Server Lifecycle ✅
- [x] Unregister tools when servers stop (added serverStopCallback)
- [x] Handle server crashes gracefully (exit event handler unregisters tools)
- [x] Clean up request queues and IDs on server stop
- [x] Improve extension lifecycle integration (tools cleaned up on extension disable)

### Task 5: Testing & Documentation ✅
- [x] Test server start/stop lifecycle (all servers discovered, tools registered)
- [x] Test dashboard query end-to-end (fixed timeout issue)
- [x] Update architecture documentation (Phase 2 Summary created)
- [x] Create MCP server development guide (comprehensive guide with templates)

## Success Criteria

Phase 2 is complete when:
- ✅ Zero hardcoded server names in core code
- ✅ All MCP servers follow consistent patterns
- ✅ Server lifecycle fully managed
- ✅ Dashboard flow abstracted
- ✅ All servers expose tools via `tools/list`

## Estimated Effort

- Task 1: 2-3 hours
- Task 2: 2-3 hours
- Task 3: 3-4 hours
- Task 4: 2-3 hours
- Task 5: 1-2 hours

**Total:** ~10-15 hours
