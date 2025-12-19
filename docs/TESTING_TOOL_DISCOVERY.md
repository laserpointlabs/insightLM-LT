# Manual Testing Guide: Tool Discovery

## Quick Test Checklist

### 1. Check Console Logs for Tool Discovery

When the app starts, you should see logs like:

```
[MCP] Starting server: workbook-rag, enabled: true
[MCP] Starting server: workbook-dashboard, enabled: true
[MCP] Discovering tools from workbook-dashboard...
[ToolRegistry] Registering 2 tools from workbook-dashboard
[ToolRegistry] Registered tool: create_dashboard_query from workbook-dashboard
[ToolRegistry] Registered tool: format_llm_response from workbook-dashboard
[LLM] Updated available tools: 6 core + 2 MCP = 8 total
```

### 2. Test Debug Endpoint (Browser Console)

Open DevTools (F12) and run:

```javascript
// Check all registered tools
const tools = await window.electronAPI.debug.getTools();
console.log('Total tools:', tools.totalTools);
console.log('Tools by server:', tools.toolsByServer);
console.log('All tools:', tools.allTools);
```

Expected output:
- `totalTools`: Should be 6+ (6 core tools + MCP tools)
- `toolsByServer`: Should show tools from `workbook-dashboard` (and `jupyter-server` if enabled)
- `allTools`: Array of all tools with their server assignments

### 3. Test Core Tools Still Work

In the chat interface, try:

1. **List workbooks:**
   ```
   List all workbooks
   ```
   Should use `list_workbooks` tool

2. **Read a file:**
   ```
   Read the file test.txt from workbook X
   ```
   Should use `read_workbook_file` tool

3. **Search content:**
   ```
   Search for "BSEO" in documents
   ```
   Should use `rag_search_content` tool (core tool that calls MCP)

### 4. Test MCP Tool Discovery

**For workbook-dashboard:**
- Tools should be discovered automatically on startup
- Check console for: `[ToolRegistry] Registering 2 tools from workbook-dashboard`

**For jupyter-server:**
- If enabled, should discover: `execute_cell`, `create_notebook`, `list_kernels`
- Check console for: `[ToolRegistry] Registering 3 tools from jupyter-server`

### 5. Verify Tool Execution Routing

The LLM should be able to use MCP tools dynamically. However, note that:
- Core tools (like `rag_search_content`) are still hardcoded but route to MCP
- MCP tools discovered via `tools/list` are fully dynamic

### 6. Test Server Lifecycle

1. **Disable an extension** (if jupyter-server is enabled via extension)
   - Tools should be unregistered
   - Check console for: `[ToolRegistry] Unregistering tool: ...`

2. **Re-enable the extension**
   - Tools should be re-registered
   - Check console for: `[ToolRegistry] Registering X tools from ...`

## Expected Console Output

### On Startup:
```
[MCP Discovery] Found server: workbook-rag, enabled: true
[MCP Discovery] Found server: workbook-dashboard, enabled: true
[MCP] Starting server: workbook-rag, enabled: true
[MCP] Starting server: workbook-dashboard, enabled: true
[MCP] Discovering tools from workbook-rag...
[MCP] workbook-rag does not support tools/list: ...
[MCP] Discovering tools from workbook-dashboard...
[ToolRegistry] Registering 2 tools from workbook-dashboard
[ToolRegistry] Registered tool: create_dashboard_query from workbook-dashboard
[ToolRegistry] Registered tool: format_llm_response from workbook-dashboard
[ToolRegistry] Notifying 1 listeners of 2 total tools
[LLM] Updated available tools: 6 core + 2 MCP = 8 total
```

### When Tools Are Used:
```
[LLM] Calling OpenAI with 8 tools available
[LLM] Tools: read_workbook_file, list_workbooks, create_file_in_workbook, search_workbooks, rag_search_content, list_all_workbook_files, create_dashboard_query, format_llm_response
```

## Troubleshooting

### Tools Not Discovered?
1. Check MCP server logs for errors
2. Verify server supports `tools/list` or sends tools in initialization
3. Check console for: `[MCP] Failed to discover tools from ...`

### Tools Discovered But Not Available?
1. Check: `[LLM] Updated available tools: ...`
2. Verify ToolRegistry subscription is working
3. Check browser console: `await window.electronAPI.debug.getTools()`

### Core Tools Not Working?
1. Verify core tools are still in `LLMService.initializeCoreTools()`
2. Check tool execution logs: `[LLM] Executing tool: ...`
















