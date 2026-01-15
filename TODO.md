# Product Roadmap (InsightLM‑LT)

This file is the **single source of truth** for roadmap planning.

- **1.0 (MVP)**: rock-solid local desktop “workbook OS” + deterministic UX + automation-safe UI.
- **1.1**: quality-of-life + scale features (bulk ops, search/sort, safety).
- **2.0**: advanced workbenches, richer integrations, improved RAG stack.

---

## Bugs captured (Jan 5, 2026) — untriaged

These are captured as numbered items for easy reference. They also appear (grouped) throughout the roadmap below.

### Chat / Tabs / Views
- [x] **1) Chat draft text is lost when switching tabs**: type in chat input → switch to another tab → return → typed text is gone (persist draft per tab/thread, or warn before losing).
- [x] **2) Opening Chat in a tabbed layout collapses/forces-close the left column view**: opening Chat into a tab area collapses/slides the left column/canvas (layout must remain stable). *(fixed + smoke-covered)*
- [x] **3) First-open refresh required for `.is` docs or Sheets**: after launch, opening a `.is` document or a sheet sometimes required a manual refresh. *(fixed + smoke-covered)*
- [ ] **4) `@` mention caret/selection offset after inserting a chip**: after selecting an `@` suggestion and inserting the chip, caret resumes in the wrong place.
- [x] **5) Duplicate/extra “thinking” indicators in chat**: remove duplicate indicator; keep a single, correct “thinking/streaming” UI. (Related: “Remove initial thinking…” below.)
- [ ] **6) Streamed chat output should render as Markdown**: streaming responses should progressively render Markdown safely/deterministically.
- [ ] **7) Chat should support “edit & rerun” + history revert**: Cursor/Continue parity; clear state model.
- [ ] **8) Add HTML renderer (where applicable)**: safe HTML rendering where appropriate (likely chat output or specific viewers).
- [x] **9) Add LaTeX/math rendering in Markdown**: support math rendering in Markdown output. *(implemented via KaTeX; smoke-covered)*

### Context / Information Architecture (design question)
- [ ] **10) Do chats always need a Context?** Consider allowing chat to *be* a context, later attach documents/workbooks. (Design discussion; not a bug.)

### Sheets / Workbooks (state + persistence + search)
Note: Prior to investing further in Luckysheet long-term, consider evaluating Univer/Univer Platform (separate decision).
- [x] **11) Sheet column widths (and other visual formatting) are not saved**: persist sheet “view state” (column width/row height/fonts/etc). *(column widths/row heights now persist; smoke-covered)*
- [ ] **12) Unsaved sheet changes are lost when switching tabs**: retain unsaved state and/or prompt to save/discard.
- [ ] **13) Search results for `.is` sheet files show wrong/missing names**: fix Workbooks search display/name mapping for `.is`.
- [x] **14) Sheets should auto-update when data/events change**: open `.is` tabs live-refresh on external writes; workbook tree refreshes after tool-driven writes. *(smoke-covered)*

### App startup UX
- [ ] **15) Add a loading indicator/progress during app startup**: avoid white screen; show deterministic progress/loader. (Related: “UI / Loading enhancements” below.)
- [x] **Dev boot reliability: wait for Vite before loading renderer**: avoid `ERR_CONNECTION_REFUSED` + Mermaid dynamic-import failures on cold start (`electron/main.ts`).

### LLM prompting (system prompt guidance)
- [x] **16) Add system prompt instructions for returning Sheets + Notebooks**: document expected formats; keep MCP/tool routing decoupled (fail-soft). *(implemented; includes KaTeX guidance + .is canonical schema/tools)*

### Chat / Planning / Governance (untriaged)
- [ ] **17) Flashing chat tab when typing**: tab UI flashes while typing in the chat composer.
- [ ] **18) App left open overnight goes white + background servers are down and won’t recover**: leave the app open overnight (or long idle) → the main window becomes white/unresponsive; after a refresh/reload the UI may appear again but MCP/local servers are stopped and do not restart.
  - Repro: open app → ensure servers are running/usable → leave running overnight (screen lock / sleep / network change may occur) → observe white screen → reload/refresh window → attempt to use features that require servers; attempt to “restart” by closing/opening views.
  - Expected: app remains responsive; services stay running or automatically reconnect/restart.
  - Actual: renderer shows white screen; after refresh UI returns but servers remain down; UI actions don’t recover servers.
  - Notes: likely sleep/hibernate/resume or child process lifecycle; capture Electron main logs around failure window.
- [ ] **19) Detached (New Window) Chat flickers while typing**: open **Chat** in a tab → use tab context menu **Move into New Window** (or **Copy into New Window**) → type in the chat composer in the detached window.
  - Expected: stable rendering while typing (no visible repaint/flicker).
  - Actual: detached window content visibly “flashes”/repaints while typing (even when scrollbars don’t appear).
  - Notes: likely a container/overflow/paint-containment mismatch between detached `windowMode=editor` layout and main workbench; chat composer autosize may be triggering full-window repaints.

### Sheets (LLM authoring contract + MCP tools)
- [ ] Define “Insight Sheet” authoring contract so LLM never guesses `.is` format: add Spreadsheet MCP tool surface (create/open/read-range/set-cells/view-state) + schema/examples. See `docs/MCP/SPREADSHEET_MCP_CONTRACT.md`.
- [ ] Reference parity for Spreadsheet MCP tool surface: use Univer MCP Start Kit “Currently Supported MCP Tools” list as a checklist for coverage. Ref: `https://github.com/dream-num/univer-mcp-start-kit`

---

## 1.0 (MVP) — “Core workflow works every time”

### Workbooks (core file/folder management)
- [x] Collision-resolution UX for moves/imports (Rename / Overwrite / Skip) when target exists
- [x] Folder context menu: **Move… / Rename / Delete** — spacing + icons + stable selectors
- [x] Document row actions: **Rename / Move / Delete** — icons + tooltips + stable selectors
- [x] Drag & drop: doc → folder, doc → workbook root — clear drop indicators
- [x] Drag & drop: folder → workbook — clearer messaging + drop targets
- [x] Prevent destructive folder delete when non-empty unless confirmed + include “contents count” in confirm text
- [x] Tighten folder row layout: action strip never overlaps long folder names (truncate + reserve space)
- [x] Ensure open tabs update when a file is moved/renamed (tab title/path stays consistent)

### Deterministic UX (no browser popups)
- [x] Replace remaining `alert/prompt/confirm` usages (audit + eliminate)
- [x] Standardize modal patterns: InputDialog / ConfirmDialog / Toast (consistent testIds + keyboard handling)

### Automation / Testability (MCP-safe)
- [x] Centralize all `data-testid` strings (expanded `src/testing/testIds.ts` + updated Workbooks/Chat/Dialogs/Toast/ActivityBar)
- [x] Ensure **selector-only** automation for critical flows (Contexts + Workbooks + Chat)
- [x] Add “Automation Mode” coverage: hover-only strips become visible and stable (smoke forces automation mode on)
- [x] Docs: keep `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md` current (canonical selectors + flows)
- [x] Add UI-level automation smoke (CDP): `npm run test:automation:smoke`
- [x] Add local “prod renderer” smoke (no electron-builder needed): `npm run test:automation:prod`
- [x] Add manual-only GitHub Action to run packaged smoke: `.github/workflows/packaged-smoke.yml` (+ how-to: `.github/workflows/PACKAGED_SMOKE_HOWTO.md`)

### Contexts (scoping / safety)
- [x] Add explicit “No context / All workbooks” mode in UI (toggle off scoping)
- [x] Make active context indicator clickable (quick jump to Contexts)

### Chat (core)
- [ ] Rename chat to iDA (Integrated Digital Assistant) (or DAS… decide)
- [x] Chat empty-state when no workbooks are scoped (link to Contexts) — deterministic + jump-to-contexts
- [x] Chat history scaffolding (minimal for MVP) — persisted single-thread per Context
- [x] LLM config files + in-app Settings (ollama/openai/asksage) — `config/app.yaml` + `config/llm.yaml` + model listing
- [x] `@` refs to workbooks/folders/docs — `workbook://...` refs + citations (typeahead)
- [x] Chats remain scoped with Context scoping when enabled
- [?] Tabbed/stored chats (evaluate need/complexity; “maybe not tabbing”)
- [ ] Out-of-scope response best practice: “I don’t know that…” (policy/UX)
- [ ] API key management (env OS first, then others)

### Dashboards (MVP)
- [x] Tile formatting always returns valid JSON (even “no data found”)
- [x] “Explain / View Sources” per tile (stable testIds + automation-safe UI)
- [x] Edit card question (in-place edit + re-run)
- [x] Tile UI clean up per best practice (compact header controls + responsive sizing)
- [x] Visualization picker per tile (Counter/Table/Graph/etc) + prod smoke validates multiple tile types
- [x] Dashboards not scoped by Context (queries ignore active Context scoping)
- [x] Dashboard question box supports `@` workbook/folder/file refs (`workbook://...`)
- [x] Graph tiles: reliable bar charts + explicit empty-state for no data
- [x] Graph tiles quality: improve CSV-backed extraction (grouping/column picking) + smoke asserts >1 bar

### CI / Packaging / Updates
- [ ] CI build artifacts (NSIS installer + portable)
- [ ] Auto-update pipeline (release + install)
- [ ] Auto-update (Windows / electron-updater) best practices: implement per `docs/AUTO_UPDATE_IMPLEMENTATION.md` (UX state machine, no silent downloads, NSIS “cannot be closed” mitigation, `latest.yml` naming correctness, smoke proof)
- [ ] Basic crash log capture + “Report Issue” bundle (logs + config)

### Demo readiness + correctness (MVP polish)
- [ ] Add “Load demo” to top toolbar (AC-1000 + trade study demo workbooks)
- [ ] Clean up smoke test artifacts (so demos/dev workspaces stay clean)
- [ ] Create proper production/dev smoke test `app.config` / config wiring

### Known bugs / corrections (MVP-level)
- [x] Tab focus bug: after saving a tab, the last tab is brought forward (should keep the current/saved tab active)
- [ ] Add link from dashboard card to supporting information (sources/content)
- [ ] Fix Chat Settings to work without selecting a context (also see duplicate item under “Other fixes…”)
- [ ] Fix overflow on right side of the canvas
- [ ] Tabs/layout (VS Code parity):
  - [x] Support editor groups (split vertical/horizontal) so users can view Chat + documents simultaneously.
  - [ ] Allow Chat to dock as a sidecar/panel (beyond “Chat as a tab”). (Reference Map required)

### Notes
- Notes: Need to work on CRUD operations by LLM

---

## 1.1 — “Scale & safety”

### Dashboards
- [ ] Spreadsheet range charts: allow questions like “plot A1:C5 as a line chart” (multi-series), infer X axis, render multiple lines
- [ ] Time tracking tiles where the change in values is stored and plotted over time
- [ ] Color coded based on cell colors in spreadsheet (pass/fail/warn values propagate to dashboard)

### Workbooks (power user)
- [ ] Bulk operations: multi-select + move/delete/rename/archive (docs + folders)
- [ ] Search/filter + sort in Workbooks tree (name/type/modified)
- [ ] Soft delete (Trash) + restore (docs + folders)
- [ ] “Reveal in Explorer” + “Copy path” actions
- [ ] Folder stats (item count + last modified) and lazy rendering for large trees

### RAG / Indexing
- [ ] Decide “when vector DB is required” vs on-demand (single-user installs may not need it)
  - Current state: **workbook-rag is on-demand content search** (no vector store) and is already quite good for MVP
  - Add vector DB when: large corpus, latency becomes an issue, semantic search needed beyond keyword/context excerpts
- [x] No-legacy results after delete: remove stale metadata entries + harden workbook-rag cache + regression test (`npm run test:rag:delete`)
- [ ] Fix / restore missing `mcp-servers/workbook-rag/index.py` workflow (or remove stale path)
- [ ] Background indexing status UI (queue, progress, last index time)
- [ ] Full local RAG (vector store) implementation (Chroma or LanceDB)
  - [ ] Choose store: **Chroma** (simple local) vs **LanceDB** (fast, file-based, good for desktop)
  - [ ] Define canonical document identity + tombstones (workbookId + docId/path + version)
  - [ ] Incremental indexing pipeline (add/update/move/rename/delete) with **hard delete from index**
  - [ ] Index schema: chunking strategy, metadata fields, embeddings model choice, dedupe
  - [ ] Hybrid retrieval: BM25/keyword + vector + reranker (optional)
  - [ ] “Reindex all” + “reindex workbook” tools + safety/locking
  - [ ] Regression tests: no-legacy results after delete/move/overwrite (vector store + metadata)

### Extensions
- [ ] Jupyter integration polish (kernel selection, error surfacing)
- [ ] Evaluate adopting/extending against external `jupyter-mcp-server` tool surface (possible replacement or parity target). Ref: `https://pypi.org/project/jupyter-mcp-server/`
- [ ] Spreadsheet integration polish (import/export, stable sheet ids)
  - [ ] Cleanup: remove now-unused Luckysheet `loadPluginScript()` code path in `src/extensions/spreadsheet/SpreadsheetViewer.tsx` (we intentionally stopped loading `plugin.js` to avoid AMD/jQuery define collisions)

### QA / Testing
- [ ] Add UI-level smoke tests for Workbooks move/rename/delete (automation selectors)
- [ ] Add regression tests for folder move collisions and rename cascades

### Security / Demo proof (Project-scoped access)
- [x] Enforce + prove “Project-only” data access for Chat/RAG: deny absolute paths, path traversal (`..`), and symlink escape; add deterministic “deny” test. See `docs/Standards/PROJECT_DATA_ACCESS_BOUNDARY.md`.

### Projects (Workspace parity)
- [x] Add first-class Projects (VS Code Workspace parity): File → New/Open/Open Recent + project-scoped persistence (layout/tabs/chat/contexts/workbooks/dashboards). See `docs/Standards/PROJECTS_WORKSPACES.md`.

---

## 2.0 — “Workbenches & advanced capabilities”

### Workbenches
- [ ] Data Workbench
- [ ] Requirements Workbench (needs / desirements)
- [ ] Ontology Workbench
- [ ] Process Workbench
- [ ] Reporting Workbench

### Dashboards (advanced)
- [ ] Dashboard “create from chat” flows + templates
- [ ] Link from dashboard tile to `@file`, `@workbook`, `@chat`, `@object`

### RAG stack upgrades
- [ ] Vectorstore + reranker integration (Chroma/LanceDB + reranker) + benchmarks/tests

### Integrations
- [ ] JupyterLab server (multi-kernel)
- [ ] BPMN / workflow integration

### Containerization / portability
- [ ] Multi-build with containers → portable distribution

---

## Backlog (nice-to-haves / not scheduled)

### Editor/authoring helpers
- [ ] Right-click in document: “Ask chat to add text/diagram here...” (inline authoring helpers)

### Chat becomes iDA (Integrated Digital Assistant)
- [ ] Update Chat Area (rename label from Chat → iDA)
- [x] Add @(Focused Context)
- [ ] Add /(Commands), Rules; save as hidden workbook; allow importing a central/general workbook of this type
- [ ] Add actions and command `/Commands`
- [ ] Add `/CreateRule` (store the rules)
- [ ] Add Teams, Agents, Ask, and Plan capabilities
- [ ] Allow chat view to move to full “other” side of the workspace
- [ ] Chunk and store chat for scope in vector store when available
  - [ ] Add chat content to current context by saving as a file (needs design)

### Import workbook/dashboard stack
- [ ] Allow a user to import a prebuilt workbook and dashboard stack
- [ ] Allow general workbook imports (general or specialized knowledge base workbooks). Allow general workbooks to hide/show imports.

### iDA (Chat) functionality
- [ ] Allow a chat thread to be associated/linked to workbooks, folders, files, dashboards, models, data, etc. Capture a knowledge graph.
  - Typical use case: building ontology/model in chat; capture dev process for traceability.

### Ontology integrations
- [ ] Provide ontology capability (initially allow user to create `.owl` files)
- [ ] Provide ontology understanding + import workbook templates for SE, etc.
- [ ] Understand ontology usage in InsightLM ecosystem (conceptualizer use case; Requirements → Ontology → Concept Graph → Individuals → Knowledge Graph → Study)

### Notebooks
- [ ] Add dot or `@` notation to notebooks to capture datasets/documents for study
  - Use case: typing `.workbook_name/decision_matrix.is` or `@.workbook_name/decision_matrix.is` imports data into notebook

### UI / Loading enhancements
- [ ] Add loading rotator and inform user while waiting (general)
- [ ] Add PDF, Word, and Excel import/export

### Git integrations
- [ ] Add methods to perform versioning using git
- [ ] Evaluate GitMCP as a **reference/optional integration** for AI-safe access to GitHub repo docs/code (fetch/search), not as a replacement for local git versioning. Ref: `https://github.com/idosal/git-mcp`

### MCP Servers (ideas)
- [ ] Investigate trade study MCP server
- [ ] Investigate MCDA MCP server
- [ ] Multimodal server with recongnition (robot vision extension)
- [ ] Others?

### CDNs
- [ ] Download all necessary CDNs at initial build (offline-friendly)

### Quick Fixes and Bugs (historical list; some complete)
- This list duplicates many items already captured in the **numbered bug list** at the top of this file.
- Action: when adding a new bug/feature request, add it to the **numbered list** (or a roadmap section below), not here.
- TODO: remove this legacy section once any remaining unique items have been migrated.

### Other fixes and bugs (later)
- [ ] Change move icon to ↓↑
- [ ] Add loading rotator and reports to user during Windows loading phase
- [x] Add split for chat tab and other tabs so user can review and chat at same time
- [x] Animate the “Thinking…” indicator in chat
- [x] Fix the double sources
  - [x] Improve the visual appeal of sources in AI chat response
- [x] Add split to tabs area to allow side-by-side viewer of multiple tabs
- [ ] Clean up smoke testing workbooks and dashboards
- [ ] Allow AI access to application context (current tabs, chat modes, chat data, open workbenches, loaded extensions, etc.)
- [x] Add workbook search
- [ ] Add selection from document or sheet to chat with metadata
- [ ] Make AI aware of date and time
- [ ] Manually adjust size of dashboard card
- [ ] Manually configure dashboard grid size
- [ ] Vary the icon for file types
- [ ] Allow user to view and modify chat settings when no context is set (duplicate of MVP “Chat Settings w/o context”)
- [ ] Spreadsheets sometimes open white; can fix by reloading (needs root cause)
- [ ] Filter Workbooks view: as user types, filter workbooks/folders but still show matching contents
- [ ] Save state of sheet items (cell height/width, font, etc.) (related to bug **11**)
- [ ] Improve document tab capability (drag order, rename, etc.)
- [ ] File context modal (save as… → PDF/Word/Excel)
- [ ] Double click view to collapse views below and expand view fully
- [x] Quickworkbooks should highlight selected context workbook in Contexts view (or add “active” indicator)
- [ ] Add copy/paste (Ctrl+C/V/etc.) commands to Workbooks view
- [ ] Dashboard scoping question: should dashboard always be scoped by an `@`? If so, add `@All` option?

### Major features
- [ ] Git integration
- [ ] Active tab priority and general addition
- [ ] Training packs: extension-like curated knowledge + test data distribution
- [ ] Knowledge packs (content sourcing): evaluate GitMCP as an optional way to pull curated docs/code from GitHub repos into a pack/import flow (repo-as-source). Ref: `https://github.com/idosal/git-mcp`
- [ ] Add “Planning and Teaming” MCP
- [ ] Extension packages (group extensions in a package for sale)

### Teams
- [ ] Add AI type chip for Teams/Agent/Ask/Plan
- [ ] Add ability to apply a teaming effort while working in chat
- [ ] Develop method to create/test/optimize a team of agents as SMEs (learning kits)

### Process / policy
- [ ] Decoupling checks after every commit? or branch merge?

---

## Backlog additions (Jan 12, 2026) — captured

### Chat / Context / UX
- [x] Should we filter Chat composer `@` results for the **current context**? (Or intentionally allow cross-context jumps.) (Scoped mode now filters `@` to active Context workbooks; smoke-covered)
- [ ] Add `/` rules for a user type (slash commands / rule invocation).
- [ ] Incorporate a **planning** flow in chat for complex problems (may use a team if needed).

### Markdown / Docs
- [ ] Add a **slide show** tool for Markdown documents.
- [x] Add **math** rendering to Markdown + Chat composer. *(KaTeX; smoke-covered)*

### Response quality / Safety
- [ ] Add confidence level (and importance?) to each response; when confidence < 70%, run `team_evaluation`.
  - [ ] Allow the LLM to select the team based on the context.
  - [ ] Maybe generate the team based on context.
    - [ ] Add a test suite to evaluate responses (possible human-in-the-loop).
  - [ ] Persona MCP server + knowledge pack (proof?).
- [ ] Bias evaluation module (detect/identify bias).

### Packaging / Architecture
- [ ] Portable and decoupled as much as possible.
- [ ] Add decoupling check per smoke.

---

## UI / Layout follow-ups (next)
- [x] **Status bar (bottom)**: add a VS Code-like status bar row at the bottom of the workbench.
  - [x] Move **Project** indicator (currently in the top area) into the status bar.
  - [x] Move **Scope** indicator (Scoped/All + active context summary) into the status bar.
- [x] **Top title bar**: move the menu bar into the very top title/header row (VS Code/Cursor-style) to maximize vertical workspace area.

---

## Extensions Workbench (completed)
- [x] **Extensions Activity Bar icon**: add a new icon to the left Activity Bar for Extensions.
- [x] **Extensions Workbench**: clicking opens an Extensions workbench (like Data/Analysis/Event placeholders).
- [x] **Extensions list**: list registered extensions from `extensionRegistry` with stable testIds.
- [x] **Enable/disable checkbox**: checkbox per extension toggles enabled state (best-effort start/stop MCP server; fail-soft).
- [x] **Extension details tab**: clicking an extension opens a main editor tab showing manifest-driven details (decoupled).
- [x] **Deterministic smoke**: `npm run smoke:run` covers list + toggle + open details tab.

---

## Demo agenda (tomorrow)

### Spreadsheet persistence (Luckysheet) — fix
- [ ] Persist sheet view state: **column widths**, row heights, and basic styling/formatting across reloads.
- [ ] Prove via a deterministic test: change widths/styles → reload app → verify preserved.

### Demo #1 — AC1000 (prove)
- [ ] Run + record deterministic proof for the AC1000 demo flow end-to-end.

### Demo #2 — Trade Study (prove)
- [ ] Run + record deterministic proof for the Trade Study demo flow end-to-end.

### Demo #3 — Conceptualizer (new)
- [ ] Define Conceptualizer workflow: ingest a CDD → generate requirements → conceptualize aircraft from CDD perspective.
- [ ] Decide extension shape:
  - [ ] Option A: dedicated **ontology/conceptualization extension**
  - [ ] Option B: single combined extension (ontology + individuals/conceptualizer)
- [ ] Draft tool surface + outputs (requirements artifacts, conceptual model artifacts) and how they are saved into workbooks.

### Stretch demo — Lattice development (ODRAS-style)
- [ ] Define “project lattice” workflow (ODRAS plugin precedent): build a lattice of projects coupled via **pub/sub**.
- [ ] Decide whether this is:
  - [ ] a new extension, or
  - [ ] part of the Conceptualizer/ontology extension.
