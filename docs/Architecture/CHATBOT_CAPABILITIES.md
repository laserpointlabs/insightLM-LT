# Chatbot capabilities (in-app LLM) — current state

This document describes **what tools the in-app LLM (“the chatbot”) can actually use today** in insightLM-LT, and what it cannot.

The key point: **tool access is determined at runtime** by what tools are registered in the app’s `ToolRegistry`:

- **Core tools**: implemented directly inside the Electron app (always available)
- **MCP tools**: discovered from local `mcp-servers/*/config.json` and exposed by each server via MCP `tools/list` (available only if the server is running and successfully registers tools)

---

## What the chatbot can do today

### Core tools (always available)

These are registered by `LLMService.registerCoreTools()` and executed inside the app:

- **`list_workbooks`**: lists non-archived workbooks (scoped to active Context if one is active)
- **`read_workbook`**: returns a workbook’s structure (folders + document metadata)
- **`list_all_workbook_files`**: lists all files across all non-archived workbooks (scoped)
- **`search_workbooks`**: filename search across workbook documents (scoped)
- **`read_workbook_file`**: reads the full contents of a workbook file by `(workbookId, filePath)`
- **`create_file_in_workbook`**: writes a new file (typically `documents/*.md`) into a workbook and updates `workbook.json`

Practical impact for documentation:

- You can ask the chatbot to **draft docs** and then have it **save them into a workbook** as Markdown via `create_file_in_workbook`.
- The in-app Markdown viewer supports **Mermaid diagrams** (Markdown fenced block with ` ```mermaid `), so the chatbot can generate **architecture diagrams** as Mermaid text and you can render them directly in the app.

### MCP tools (available if local MCP servers are running)

On app startup, enabled servers under `mcp-servers/` are auto-started (except “extension-managed” servers), and the app calls MCP `tools/list` to discover tools.

Current enabled MCP servers in this repo (see `mcp-servers/*/config.json`) and their tools:

#### `workbook-rag` (content search / RAG)

- **`rag_search_content`**: searches *inside* documents (PDF/DOCX/spreadsheets/text) across workbooks; supports `workbook_ids` scoping
- **`rag_list_files`**: lists all files with metadata; supports `workbook_ids` scoping
- **`rag_read_file`**: reads full contents of a specific file (server-side read path)
- **`rag_clear_cache`**: clears server-side cache (useful after deletes/moves)

Notes:

- The app injects `workbook_ids` automatically into `rag_search_content` / `rag_list_files` when a **Context** is active, preventing cross-context leakage.

#### `context-manager` (Context scoping)

- **`create_context`**, **`list_contexts`**, **`get_context`**, **`update_context`**, **`delete_context`**
- **`activate_context`**, **`get_active_context`**
- **`get_context_workbooks`** (used by the app to scope core + RAG listing/search)

#### `workbook-manager` (workbook CRUD/structure)

- **`create_workbook`**
- **`list_workbooks`**
- **`get_workbook_structure`**
- **`list_folders_in_workbook`**
- **`list_files_in_workbook`** / **`list_files_in_folder`**
- **`get_file_metadata`**

#### `workbook-dashboard` (dashboard formatting helper)

- **`format_llm_response`**: formats an LLM response payload for dashboard tile types (pure formatter)

#### `spreadsheet-server` (spreadsheet helpers)

- **`calculate_cell`**: computes a formula with a supplied context map
- **`get_sheet_data_for_rag`**: returns spreadsheet text/formula info formatted for indexing (currently stubby)

#### `document-parser` (document parsing helpers)

- **`parse_pdf`**, **`parse_docx`** (currently stubbed in server implementation)

#### `jupyter-server` (Python execution; extension-managed)

- **`execute_cell`**
- **`create_notebook`**
- **`list_kernels`**

Notes:

- `jupyter-server` is marked “extension-managed” in `electron/main.ts`, so it is **not auto-started** by default; it becomes available when its extension starts it.

---

## What the chatbot cannot do (unless you add a tool)

- **No web browsing / no “read arbitrary URLs” tool**: there is no MCP server/tool that fetches web pages, and no “browser” tool exposed to the in-app LLM.
- **No Context7**: Context7 exists in some developer environments, but **your in-app LLM does not have Context7** unless you add an MCP server that provides that capability.

Important nuance:

- The LLM provider itself may be remote (e.g., OpenAI/Anthropic) depending on configuration, but that’s **not the same as having a “browse the web” tool**.

---

## How to verify what tools your chatbot has at runtime

Because MCP tools are discovered dynamically, the authoritative answer is always “what the app registered.”

High-signal checks:

- **Enabled servers**: inspect `mcp-servers/*/config.json` (`enabled: true`)
- **Server running**: MCP tools only work if the server process is running
- **Tool discovery**: each MCP server must answer `tools/list` with tool definitions

If you want to document “production capabilities,” document:

- The **core tools** above (always present)
- The **MCP server set** you ship and auto-start (and any extension-managed servers you require)
