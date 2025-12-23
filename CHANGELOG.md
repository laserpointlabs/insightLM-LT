# Changelog

All notable changes to the insightLM-LT project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 2025-12-20 - Jupyter MCP path + persistence hardening (workbook-safe)

#### Added
- **Jupyter MCP notebook persistence**
  - `execute_cell` can persist the executed cell + outputs into a notebook file (and updates workbook metadata) so opening the `.ipynb` shows the executed cell output.
- **Jupyter MCP Windows workbook path support**
  - `create_notebook` now supports `workbook://<id>/documents/...` paths (prevents WinError 123 on Windows).
- **Testing**
  - Added/extended `npm run test:jupyter:path` to cover `workbook://` notebook creation and persisted execution output.

#### Fixed
- **Guardrails against “fake execution” and mistaken workbook creation**
  - Prevent common LLM misfire where it tries to `create_workbook` using a `.ipynb` file name / path.
  - Prevent notebook “fake execution” by writing outputs directly (execution should come from `execute_cell`).

### 2025-12-19 - Hotfix: `.is` / viewer crash hardening (no more white screen)

#### Fixed

- **DocumentViewer crash containment**
  - Added a viewer-level error boundary so a bad viewer render cannot white-screen the whole app.
  - Error UI is deterministic and allows the user to retry or close the affected tab.

- **NotebookViewer robustness**
  - Hardened notebook parsing/normalization to tolerate missing/invalid fields (e.g., missing `cells` or non-string `source`) without throwing.
  - Prevents `Cannot read properties of undefined (reading 'length')`-style crashes observed when opening problematic documents.

#### Testing

- Verified via **prod-renderer CDP smoke** (`npm run test:automation:prod`) including opening a seeded `.is` sheet (`decision_matrix.is`) and confirming the spreadsheet viewer mounts.

### 2025-12-18 - Chat MVP (Scoped + Deterministic + Testable)

#### Added

- **Scoped Chat empty-state (demo-safe)**
  - Chat now shows a deterministic empty state when there is **no active Context** or when **Scoped mode yields 0 in-scope workbooks**
  - Added a **“Go to Contexts”** button to jump directly to Contexts to fix scoping
  - Added explicit loading state and stable `data-testid`s for automation

- **Persisted chat history (single-thread per Context)**
  - Minimal persisted chat history backed by an Electron `ChatService` with deterministic ordering and stable message IDs
  - Thread is restored on restart, and can be cleared deterministically

- **LLM provider configuration (testable, no prompts)**
  - YAML-backed config support for provider selection via `config/app.yaml` and `config/llm.yaml`
  - In-app Settings tab in Chat to edit provider/model/baseUrl/apiKey without browser prompts/alerts
  - Added `llm:listModels` IPC and UI “Refresh” button to list models from OpenAI/Claude/Ollama (and compatible gateways)
  - Added per-provider profiles so switching providers restores provider-specific model/apiKey/baseUrl values

- **Lightweight `@refs` in chat composer**
  - `@` mention menu inserts deterministic references like `workbook://...`
  - Responses include a deterministic “Sources” footer when files were read/used

- **Chat composer UX**
  - Multiline, word-wrapping chat input (2 rows by default) with Ctrl/Cmd+Enter send
  - Continue.dev-inspired full-width composer with improved send button
  - Streaming (typewriter) assistant rendering so responses appear progressively even when provider doesn’t support native token streaming

#### Changed

- **Tool execution + scoping**
  - Tool execution is routed via `ToolProviderRegistry` and scoping is applied for RAG/list tools when a Context is active
  - Hardened Ollama/gateway tool-call parsing to tolerate fenced JSON and extra prose around `{"tool":"...","args":{...}}`
  - Lowered temperature for the Ollama tool-call decision step to reduce formatting variance with smaller local models

- **Automation/test stability**
  - Expanded centralized `data-testid`s for Chat empty states, tabs, settings, model refresh, mentions, streaming
  - Updated CDP smoke automation to cover deterministic Chat “SCOPED context” flow and chat mentions
  - Relaxed provider-dependent dashboard assertions to avoid false failures when local models vary in output shape

#### Fixed

- **Ollama gateway auth**
  - Ollama-compatible gateways that require `Authorization: Bearer ...` are now supported when an apiKey is configured

#### Notes / Known Issues

- Local models may still return non-standard JSON shapes for dashboards; the app is fail-soft and automation avoids asserting provider-specific result types.

### 2025-01-15 - JupyterLab Extension Development & Architecture Planning

#### Added

- **JupyterLab Extension Foundation**
  - Created JupyterLab extension with NotebookViewer component
  - Integrated Jupyter notebook file handler (`.ipynb` files)
  - Implemented VS Code-style notebook UI with cell management
  - Added notebook creation functionality in WorkbooksView

- **Notebook Execution Features**
  - Integrated real Jupyter kernel execution via MCP server
  - Implemented cell execution with Python code
  - Added output rendering for execution results, streams, and errors
  - Created MCP integration for `jupyterExecuteCell` IPC handler

- **Keyboard Shortcuts**
  - Added **Ctrl+Enter** to execute current cell (Jupyter standard)
  - Added **Shift+Enter** to execute cell and move to next (or create new)
  - Implemented keyboard shortcuts for both code and markdown cells
  - Added visual focus indicators when moving between cells

- **Visual Enhancements**
  - Added cell focus highlighting (blue border, shadow, ring)
  - Implemented smooth scrolling to next cell on Shift+Enter
  - Added execution counters and cell type indicators
  - Improved VS Code-style cell toolbar and actions

- **Documentation**
  - Created `docs/extension-licensing-architecture.md` - Comprehensive licensing architecture with Mermaid diagrams
  - Created `docs/extension-mcp-server-bundling.md` - Architecture for bundling MCP servers with extensions
  - Created `docs/jupyterlab-extension-integration-todo.md` - Detailed TODO list for completing JupyterLab extension
  - Created `docs/mcp-server-extension-strategy.md` - Strategy for converting MCP servers to extensions with categorization

#### Changed

- **Notebook Execution**
  - Switched from simulated execution to real Jupyter kernel execution
  - Updated output processing to handle MCP server response formats
  - Improved error handling and logging for execution failures

- **Extension System**
  - Enhanced extension registry to support file handlers
  - Added async component loading for extension components
  - Improved extension discovery and registration

#### Fixed

- **React Errors**
  - Fixed "Objects are not valid as a React child (found: [object Promise])" error
  - Created AsyncComponentLoader to properly handle dynamic imports
  - Fixed file handler component loading

- **Notebook Execution**
  - Fixed MCP server integration for Jupyter execution
  - Resolved output format parsing issues
  - Fixed cell execution result rendering

- **File Handling**
  - Fixed notebook file creation in WorkbooksView
  - Corrected file path handling for new notebooks
  - Fixed file extension matching in DocumentViewer

#### Issues Encountered

- **Electron MCP Server Troubleshooting**
  - **Major Issue**: Electron MCP server (`electron-mcp-server`) did not work as expected for debugging
  - Attempted to use electron-mcp-server to directly inspect Electron app and debug issues
  - Server only provided 4 tools instead of expected functionality
  - Could not successfully launch Electron app with debugging via MCP server
  - Had to rely on terminal output and manual error reporting instead
  - **Impact**: Slowed down debugging process significantly, made it difficult to see real-time errors
  - **Workaround**: Used console logs, terminal output, and user-reported errors

- **PowerShell Issues**
  - User experienced significant frustration with PowerShell commands
  - Many commands failed or timed out
  - Had to switch to simpler command approaches
  - **Resolution**: Avoided complex PowerShell commands, used direct Python/Node commands instead

- **MCP Server Startup**
  - Initial issues with `jupyter-server` MCP server not being detected
  - Server configuration and startup needed debugging
  - Fixed by ensuring proper server discovery and startup in MCPService

- **Output Format Parsing**
  - Multiple iterations to correctly parse MCP server execution results
  - Had to handle different response formats from MCP protocol
  - Fixed by adding comprehensive result format handling in NotebookViewer

#### Technical Debt

- **Extension Architecture**
  - MCP servers still in separate `mcp-servers/` directory (not bundled with extensions)
  - Notebook creation icon still in core WorkbooksView (should be in extension)
  - Extension enable/disable functionality not yet implemented
  - Extension contributions system (toolbar buttons, menu items) not fully implemented

- **Code Organization**
  - Some hardcoded references to MCP server names
  - Extension API not yet extension-scoped (still uses direct MCP calls)
  - Need to migrate to extension-based MCP server registration

#### Tomorrow's Plan

**Primary Goal**: Complete JupyterLab Extension Integration

1. **Phase 1: MCP Server Bundling**
   - Move `mcp-servers/jupyter-server/` to `extensions/jupyterlab/mcp-server/`
   - Update extension manifest with `mcpServer` declaration
   - Enhance Extension Registry to discover MCP servers from extensions
   - Update MCP Service to accept extension-registered servers

2. **Phase 2: Enable/Disable Functionality**
   - Implement extension state management (enabled/disabled)
   - Create Extension Manager UI component
   - Add enable/disable methods to Extension Registry
   - Test extension lifecycle (enable → disable → enable)

3. **Phase 3: Move UI Contributions**
   - Move notebook creation icon from WorkbooksView to JupyterLab extension
   - Implement extension contribution system (toolbar buttons)
   - Update Extension Registry to render extension contributions
   - Make WorkbooksView extension-agnostic

4. **Phase 4: Extension API Updates**
   - Create extension-scoped API (`window.electronAPI.extensions.call()`)
   - Update NotebookViewer to use new extension API
   - Update IPC handlers to route via extension ID
   - Remove hardcoded MCP server references

5. **Phase 5: Testing**
   - Test enable/disable extension functionality
   - Test MCP server lifecycle with extension
   - Test UI contributions (notebook icon)
   - End-to-end notebook workflow testing

**Estimated Time**: 9-14 hours (1-2 days)

**Success Criteria**:
- ✅ MCP server bundled in extension directory
- ✅ Extension can be enabled/disabled via UI
- ✅ Notebook icon is part of extension contributions
- ✅ Extension is self-contained and portable
- ✅ No hardcoded MCP server references

#### Architecture Decisions

- **Extension = UI + MCP Server**: Decided to bundle MCP servers directly with extensions rather than keeping them separate
- **RAG as Extension**: Decided RAG should be a base extension (always enabled) for reusability
- **Advanced RAG as Premium**: Advanced RAG features will be a premium extension with upgrade path
- **Core Services Minimal**: Only truly foundational services (like Workbook Manager) stay as core services
- **Everything Else as Extensions**: Maximum reusability and portability across projects

#### Documentation Created

1. **Extension Licensing Architecture** (`docs/extension-licensing-architecture.md`)
   - Complete licensing system design
   - Base vs Premium extensions
   - License key vs Account-based vs Hybrid approaches
   - Multiple Mermaid diagrams for visualization

2. **Extension MCP Server Bundling** (`docs/extension-mcp-server-bundling.md`)
   - Architecture for bundling MCP servers with extensions
   - Extension package structure
   - MCP server integration approach
   - Migration strategy

3. **JupyterLab Extension Integration TODO** (`docs/jupyterlab-extension-integration-todo.md`)
   - Detailed task breakdown for completing JupyterLab extension
   - 6 phases with specific tasks and checkboxes
   - Estimated time and success criteria

4. **MCP Server Extension Strategy** (`docs/mcp-server-extension-strategy.md`)
   - Strategy for converting all MCP servers to extensions
   - Categorization: Core Services vs Base Extensions vs Premium Extensions
   - RAG extension strategy (Basic vs Advanced)
   - Reusability and portability approach
   - Multiple Mermaid diagrams

---

## Notes

- This changelog will be maintained going forward
- Major features and breaking changes will be documented
- Issues and resolutions will be tracked
- Future plans will be outlined in each entry
