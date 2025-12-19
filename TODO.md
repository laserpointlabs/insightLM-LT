# Product Roadmap (InsightLM‑LT)

This file is the single source of truth for roadmap planning.

- **1.0 (MVP)**: rock-solid local desktop “workbook OS” + deterministic UX + automation-safe UI.
- **1.1**: quality-of-life + scale features (bulk ops, search/sort, safety).
- **2.0**: advanced workbenches, richer integrations, improved RAG stack.

---

## 1.0 (MVP) — “Core workflow works every time”

### Workbooks (core file/folder management)
- [x] Collision-resolution UX for moves/imports (Rename / Overwrite / Skip) when target exists
- [x] Folder context menu: **Move… / Rename / Delete** — polished spacing + icons + stable selectors
- [x] Document row actions: **Rename/Move/Delete** — polished icons + kept tooltips + stable selectors
- [x] Drag & drop: doc → folder, doc → workbook root — improved visual drop indicators (clear “Drop here”/target banner)
- [x] Drag & drop: folder → workbook — improved conflict messaging + clearer drop target feedback
- [x] Prevent destructive folder delete when non-empty unless confirmed + include “contents count” in confirm text
- [x] Tighten folder row layout: action strip never overlaps long folder names (truncate + reserve space)
- [x] Ensure open tabs update when a file is moved/renamed (tab title/path stays consistent)

### Deterministic UX (no browser popups)
- [x] Replace remaining `alert/prompt/confirm` usages (audit + eliminate)
- [x] Standardize modal patterns: InputDialog / ConfirmDialog / Toast (consistent testids + keyboard handling)

### Automation / Testability (MCP-safe)
- [x] Centralize all `data-testid` strings (expanded `src/testing/testIds.ts` + updated Workbooks/Chat/Dialogs/Toast/ActivityBar)
- [x] Ensure **selector-only** automation for critical flows (Contexts + Workbooks + Chat)
- [x] Add “Automation Mode” coverage: verify hover-only strips become visible and stable (smoke forces automation mode on)
- [x] Docs: keep `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md` current (canonical selectors + flows)
- [x] Add UI-level automation smoke (CDP): `npm run test:automation:smoke`
- [x] Add local “prod renderer” smoke (no electron-builder needed): `npm run test:automation:prod`
- [x] Add manual-only GitHub Action to run packaged smoke: `.github/workflows/packaged-smoke.yml` (+ how-to: `.github/workflows/PACKAGED_SMOKE_HOWTO.md`)

### Contexts (scoping / safety)
- [x] Add explicit “No context / All workbooks” mode in UI (toggle off scoping)
- [x] Make active context indicator clickable (quick jump to Contexts)

### Chat (core)
- [ ] Rename chat to iDA (INtegrated Digital Assistant) (or DAS Digital Assistant System... lets think)
- [x] Add small UX hint when no workbooks are scoped (link to Contexts to fix) — deterministic Chat empty-state + jump-to-contexts
- [x] Add deterministic chat history scaffolding (even if minimal in 1.0) — persisted single-thread per Context
- [x] config.yaml for llm source (ollama, openai, asksage) [Critical for genernal testing] — `config/app.yaml` + `config/llm.yaml` + in-app Settings tab + model listing
- [x] @commands for specific context calls to worbooks, folders, and docs [Nice have and carries over to the dash boards] — lightweight `@` refs inserting `workbook://...` + citations. (@ commands are opening off of the bottom of the screen)
- [x] Chats are first class citizens and remain in context with the scopeing — tools are scoped to active Context workbooks when Scoped mode is enabled
- [?] (Think about not tabbing) Tabbed and stored chats where chat context is first class (we can discuss need and complexity)
- [ ] When asking a question that is out of scope the response should be somthing like "I dont know that..." per best practice.
- [ ] API key management (env.os first, then others)
  
### Dashboards (MVP)
- [x] Ensure tile formatting always returns valid JSON (even for “no data found”)
- [x] Add “Explain / View Sources” affordance per tile (stable testIds + automation-safe UI)
- [x] Allow user to edit card question (in-place edit + re-run)
- [x] General tile clean up per best practice (compact header controls + responsive results sizing)
- [x] Add Visualization picker per tile (force Counter/Table/Graph/etc) + expand prod smoke to validate multiple tile types
- [x] Ensure Dashboards are not scoped by context (dashboard queries ignore active Context scoping)
- [x] Allow direct calls to workbooks/folders/files using @ for dashboard results (Dashboard question box typeahead inserts `workbook://...` refs)
- [x] Graph tiles: ensure bar charts render reliably (avoid “hidden” charts; show explicit empty-state when no labels/values)
- [x] Graph tiles (quality): improve CSV-backed chart extraction so common questions produce multi-bar outputs (robust column picking + grouping) + smoke asserts >1 bar

### CI / Packaging / Updates
- [ ] CI build artifacts (NSIS installer + portable)
- [ ] Auto-update pipeline (release + install)
- [ ] Basic crash log capture + “Report Issue” bundle (logs + config)

### Corrections/Bugs
- [ ] When saving a tab, after the save the last tab in the list is broght forward, not the saved or current working tab

- [ ] Add load demo to top tool bar to load AC-1000 and related workbooks and the example trade study demo workbooks. 
- [ ] Add clean up Clean up smoke test artifacts
---

## 1.1 — “Scale & safety”

### Dashboards
- [ ] Spreadsheet range charts: allow questions like “plot A1:C5 as a line chart” (multi-series) from a spreadsheet, infer X axis, and render multiple lines
- [ ] Time tracking tiles where the change in values is stored and plotted over time
- [ ] Color coded based on cell colors in spread sheet - allows users to set pass/fail/warning values and propegate to dashboard without inteaction. 

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
- [ ] Spreadsheet integration polish (import/export, stable sheet ids)

### QA / Testing
- [ ] Add UI-level smoke tests for Workbooks move/rename/delete (automation selectors)
- [ ] Add regression tests for folder move collisions and rename cascades

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

### Backlog (nice-to-haves / not scheduled)
- [ ] Right-click in document: “Ask chat to add text/diagram here” (inline authoring helpers)

### Chat becomes iDA (Integrated Digital Assisant)
- [x] Update Chat Area
- [x] Add @(Focused Context), 
- [ ] Add actions and command /Commands
- [ ] Add /CreateRule (store the rules)
- [ ] Add Teams, Agents, Ask, and Plan capabilities
- [ ] Allow chat view to move to full 'other' side of the workspace
- [ ] Chunck and store chat for scope in vector store when avaiable
  - [ ] Add chat content to current context by saving as a file (Need some thoughts here)


### Import workbook/dashboard stack
- [ ] allow a user to import a prebuild workbook and dashboard stack

### MCP Servers
- [ ] Investigate trade study mcp server
- [ ] Investigate MCDA mcp server
- [ ] Others? 

### CDNs
- [ ] download all necessary cdns at inital build, we dont what to need the internet


### Quick Fixes and Bugs
- [x] @ - context direction
- [x] save llm.cfg to users appdata
  - [x] Allow user to edit llm.comfig in a new tab to edit entire yaml and to easily add new providers.
- [x] Show tool useage reporting and thinking as small or simple reporting in the chat area
- [x] Allow user to move chat area to tab for chat first working add pop-out icon
- [x] Improve scope indicator in chat area
  - [x] add a quick switch switch combobo
- [x] Show full name of files not ellipsis in @
- [ ] fix startup left trim of the views area (looks like dashbard pushes the view left) [ looks like an artiface of the automatied:prod testing]
- [x] Show selected object as a chip and highlighted for clearity
  - [x] Trim chip to just the object name
  - [x] Add chip inline in prompt text
  - [x] Fix blank spaces after inline chip isertion
- [x] Add toggle on Chat settings button, open/close
- [x] Update the context view when we set the context and scoping in the chat text area so they match. (verify)
- [ ] Remove inital thinking and animate the actual thinkng...
- [x] Render mermaid in the chat text area
- [x] Store chat tab state
- [x] When a user selectes a new context auto change to scoped if in the all state.
- [x] Ensure tabs remain open after refrech
- [ ] Auto close the chat view when we pop-out to the tabbed view
- [ ] Workbooks listed natrually to context so a user can just select them without create a spcial context view of just a single workbook. This can also be a general list in the context chip.

 - [ ] Add automationState.workbooks mapping (name → id/path) to enable deterministic Workbooks UI automation using existing testIds.
 - [ ] Improved handling of the views and collapsed stated to preved overlaping edge of screen
 - [ ] Remove the workds Context: and Scope: frm
 

## Other fixes and bugs for later
- [ ] change move icon to ↓↑ in 
- [ ] Add loadng rotator and reports to user when  at windows loading phase
- [ ] Add split for chat tab and other tabs so use can reivew and chat at the same time
- [ ] Animate the 'Thinking...' indicator in the chat
- [ ] Fix the double sources
  - [ ] Improve the visual appeal of the sources in the AI chat response
- [ ] Add split to tabs area to allow side by side viewer of mutliple tabs
- [ ] Clean up smoke testing worbooks and Dashboards
- [ ] Allow AI access to application context (currnet tabs, chat modes, chat data and chat(s), open workbenchs, loaded extensions, etc. )
- [x] Add workbook search
- [ ] Add selection from document or sheet to chat wiht mete-data.
- [ ] Make AI aware of date and time. 
- [ ] Manually adjust size of dashboard card
- [ ] Manually configure dahboard grid size
- [ ] Vari the icon for file types.
- [ ] Allow user to view and modify chat settings when no context is set.
- [ ] Spreadsheets are opening white sometimes, not sure what the trigger is but I can fix by reloading the the app under view reload. ) [Working right now - 12/19/2025]
- [ ] Filter Workbooks view such that as the user types the search Worbkooks/Folders are filtertered out but still show contents so if I have a workbook "Test" Show and I start Te.. show the workbook and any files in the workbook that may be te.. also 
- [ ] Save state of sheet items (cell hight/width, font, etc.)
- [ ] IMprove document tab calaibltity (drag order, rename, .etc)
- [ ] file context modal (save as... → pdf, word, excel)
- [ ] Double click view to collas views below and expand view fully


### Major features
- [ ] Git integration
- [ ] Active tab priority and general addition
- [ ] Traning Paks: Add extension like traning for knowledge that has been curated and tested users can purchase and recieve testing data (like the old days with anasys :)
- [ ] Add 'Planning and Teaming' mcp
- [ ] Extension packages (Group extensions in a package for sale)
