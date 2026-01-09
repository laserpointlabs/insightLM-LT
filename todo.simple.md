# Working List (Simplified) — InsightLM‑LT

This is the **day-to-day** working list. The full source of truth remains `todo.md`.

## Now (stability blockers)

- **Chat composer reliability**: autosize/wrap/caret stability; mention insertion/chips not shifting text. (todo.md: **1, 4, 5, 6**)
- **Chat usable with no Context**: settings accessible + sane behavior even when no context is selected. (todo.md: “Fix Chat Settings to work without selecting a context”, “Allow user to view and modify chat settings when no context is set.”)
- **Tabs + state persistence**: keep drafts/unsaved edits across tab switches; tab focus stays on the tab you saved. (todo.md: **1, 12**, and “Corrections/Bugs” tab-focus item)
- **Tabbed UX (VS Code parity)**: split editor groups (vertical/horizontal) + dock Chat as a panel/sidecar so you can see Chat and other tabs simultaneously (no constant switching). (todo.md: add “Editor groups / dock chat”)
- **Layout stability**: opening Chat in tabbed layout must not collapse/force-close left column; prevent view overlap/edge clipping artifacts. (todo.md: **2**, “Improved handling of views open/collapsed…”, “startup left trim…”, “overflow on right side…")
- **Sheets reliability**: first-open refresh bug; wrong sheet names in search; persist sheet view state (column widths). (todo.md: **3, 11, 13**)
- **Project data access boundary (demo proof)**: ensure Chat/RAG can only read current project/workbooks (deny absolute/traversal/symlink escape) + add a deterministic deny test. (Doc: `docs/Standards/PROJECT_DATA_ACCESS_BOUNDARY.md`)
- **Demo readiness tooling**: one-click “Load demo” + clean up smoke artifacts + keep demo/smoke configs deterministic. (todo.md: “Add load demo…”, “Add clean up smoke test artifacts”, “Create proper production/dev smoke test app.config”)
- **Spreadsheet MCP parity reference**: use Univer MCP Start Kit tool list as coverage checklist for `.is` Spreadsheet MCP tools. Ref: `https://github.com/dream-num/univer-mcp-start-kit`

## Next (quality-of-life that unlocks daily use)

- **Chat edit & rerun + history revert** (Cursor/Continue parity). (todo.md: **7**)
- **Startup UX**: deterministic loading indicator/progress (no white screen). (todo.md: **15**, “UI / Loading enhancements”)
- **Auto-refresh on data changes**: sheets/workbooks/dashboards refresh without manual reload. (todo.md: **14**)
- **Projects (Workspace parity)**: file/open recent + project-scoped persistence for layout/tabs/chat/contexts/workbooks/dashboards. (Design doc: `docs/Standards/PROJECTS_WORKSPACES.md`)

## Later (larger scope / design or platform work)

- **Chat: HTML + LaTeX/math rendering** with safety constraints. (todo.md: **8, 9**)
- **Workbooks power-user**: bulk ops, sort/filter, trash/restore, reveal/copy path. (todo.md: 1.1 Workbooks)
- **RAG/indexing upgrades** (vector DB, background indexing UI, etc.). (todo.md: RAG section)
- **Packaging/updates/crash logs**. (todo.md: CI/Packaging/Updates)
- **Auto-update (Windows / electron-updater)**: implement best-practice update UX + installer reliability per `docs/AUTO_UPDATE_IMPLEMENTATION.md`. (todo.md: CI/Packaging/Updates)
- **Design question**: whether chats require contexts / chat-as-context. (todo.md: **10**)

## Operating rule

- Work items that touch **views/layout/tabs** follow **VS Code parity**.
- Work items that touch **chat UX** follow **Continue/Cursor parity**.
- For each “Now/Next” item: produce a **Reference Map** first, then implement + add deterministic smoke coverage.
