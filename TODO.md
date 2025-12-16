# Product Roadmap (InsightLM‑LT)

This file is the single source of truth for roadmap planning.

- **1.0 (MVP)**: rock-solid local desktop “workbook OS” + deterministic UX + automation-safe UI.
- **1.1**: quality-of-life + scale features (bulk ops, search/sort, safety).
- **2.0**: advanced workbenches, richer integrations, improved RAG stack.

---

## 1.0 (MVP) — “Core workflow works every time”

### Workbooks (core file/folder management)
- [ ] Collision-resolution UX for moves/imports (Rename / Overwrite / Skip) when target exists
- [ ] Folder context menu: **Rename/Delete** (already implemented) + add **Move…** (implemented) + polish
- [ ] Document row actions: **Rename/Move/Delete** (implemented) + polish icons + tooltips
- [ ] Drag & drop: doc → folder, doc → workbook root (implemented) + improve visual drop indicators
- [ ] Drag & drop: folder → workbook (implemented) + improve conflict messaging
- [ ] Prevent destructive folder delete when non-empty unless confirmed (implemented) + add “show contents count” in confirm text
- [ ] Ensure open tabs update when a file is moved/renamed (tab title/path stays consistent)

### Deterministic UX (no browser popups)
- [ ] Replace remaining `alert/prompt/confirm` usages (audit + eliminate)
- [ ] Standardize modal patterns: InputDialog / ConfirmDialog / Toast (consistent testids + keyboard handling)

### Automation / Testability (MCP-safe)
- [ ] Centralize all `data-testid` strings (continue expanding `src/testing/testIds.ts`)
- [ ] Ensure **selector-only** automation for critical flows (Contexts + Workbooks + Chat)
- [ ] Add “Automation Mode” coverage: verify hover-only strips become visible and stable
- [ ] Docs: keep `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md` current

### Contexts (scoping / safety)
- [ ] Add explicit “No context / All workbooks” mode in UI (toggle off scoping)
- [ ] Make active context indicator clickable (quick jump to Contexts)

### Chat (core)
- [ ] Add small UX hint when no workbooks are scoped (link to Contexts to fix)
- [ ] Add deterministic chat history scaffolding (even if minimal in 1.0)

### Dashboards (MVP)
- [ ] Ensure tile formatting always returns valid JSON (even for “no data found”)
- [ ] Add “Explain / View Sources” affordance per tile

### CI / Packaging / Updates
- [ ] CI build artifacts (NSIS installer + portable)
- [ ] Auto-update pipeline (release + install)
- [ ] Basic crash log capture + “Report Issue” bundle (logs + config)

---

## 1.1 — “Scale & safety”

### Workbooks (power user)
- [ ] Bulk operations: multi-select + move/delete/rename/archive (docs + folders)
- [ ] Search/filter + sort in Workbooks tree (name/type/modified)
- [ ] Soft delete (Trash) + restore (docs + folders)
- [ ] “Reveal in Explorer” + “Copy path” actions
- [ ] Folder stats (item count + last modified) and lazy rendering for large trees

### RAG / Indexing
- [ ] Fix / restore missing `mcp-servers/workbook-rag/index.py` workflow (or remove stale path)
- [ ] Background indexing status UI (queue, progress, last index time)

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
- [ ] Right-click in document: “Ask chat to add text/diagram here” (inline authoring helpers)
