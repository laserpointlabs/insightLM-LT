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
- [ ] Rename chat to iDA (Integrated Digital Assistant) (or DAS Digital Assistant System... lets think)
- [ ] Add small UX hint when no workbooks are scoped (link to Contexts to fix)
- [ ] Add deterministic chat history scaffolding (even if minimal in 1.0)
- [ ] Tabbed and stored chats where chat context is first class (we can discuss need and complexity)
- [ ] config.yaml for llm source (ollama, openai, asksage) [Critical for genernal testing]
- [ ] @commands for specific context calls to worbooks, folders, and docs [Nice have and carries over to the dash boards]

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

## Backlog (nice-to-haves / not scheduled)
- [ ] Right-click in document: “Ask chat to add text/diagram here...” (inline authoring helpers)

### Chat becomes iDA (Integrated Digital Assisant)
- [ ] Update chat area with 'iDA' rather than 'Chat'
- [ ] Add @(Focused Context), /(Commands), Rules, save this is a hidden workbook that can be shown by the user. Allow users to import a central or general workbook of this thype
- [ ] Add Teams, Agents, Ask, and Plan capabilities

### Import workbook/dashboard stack
- [ ] Allow a user to import a prebuild workbook and dashboard stack
- [ ] Allow general workbook imports (genernal or specific knowldege for instance an approved or specialized Systems Engineeirng KNowledge Base workbook with example SEP/SEMP, Trade Study, etc.) Allow general workblooks to hide/show imports.  

### iDA (Chat) functionality
- [ ] Allow a chat thread to be assoicated or linked to workbooks, folders, files, and dashbards, models, data, etc. Any and all objects mentioned and/or created should be linked to capture a knowldedge graph. 
  - A typical usecase might involve building an ontology model and saving it for use. As the model is created in a particular chat thread the models developement is also captured semantically which is 'real' tracability where rahter than just a link we have a fully develope process documented in the text for the model. 

### Ontology integrations (We need to think more about this and properly lay it out)
- [ ] Provide ontology capability to the tool, initally allow the user to create .owl files
- [ ] Provide an ontological understanding and development import workbook with templats for SE, etc.
- [ ] Understand how we properly emply ontologies in the insightLM ecosystem. Consider the conceptualizer use case. Requirements → Ontology (Compentace Questions, Micro Theory) → Concept Graph → Individuals → Knowledge Graph → Study)

### Notebooks
- [ ]  Add dot nor @ notation to notebooks to capture datasets, documents, etc. as usable data for the study in the notebook. 
  - Usecase: typing '.workbook_name/decision_martix.is' or '@.workbook_name/decision_martix.is imports the data into the notebook for use. 


  ### UI / Loading enhancments
- [ ] Add loadng rotator and inform user while waiting of what is happening.
- [ ] Add pdf, word, and excel import/export 

  ### Git integrations
  - [ ] Add methods to perform versioning using git
