### Reference Map — **Insight Sheets: Persistence + Stability + MCP authoring**

#### Upstream reference (authoritative)
- **Luckysheet docs (view/config persistence)**:
  - Config + sheet JSON keys (row/column sizing, sheet config): `https://dream-num.github.io/LuckysheetDocs/zh/guide/config.html`
  - Exported sheet state is available via `luckysheet.getAllSheets()` / `luckysheet.getluckysheetfile()` (as used in our renderer).
- **Repo contract (authoring tool surface)**:
  - `docs/MCP/SPREADSHEET_MCP_CONTRACT.md` (Insight Sheets MCP contract)

#### Problem statement (current repo gaps)
- **Persistence gap**: Users change **column widths / row heights / styling**, but it does not reliably persist across reloads.
- **Stability gap**: Sheets sometimes fail to initialize (scripts load race / runtime errors), or new sheets open inconsistently.
- **LLM authoring gap**: LLMs don’t reliably create `.is` sheets because the current Spreadsheet MCP server does not provide a schema/example-driven authoring surface.
- **Regression to fix (UI)**: Conditional formatting **UI actions** (adding/editing rules) must work reliably; currently user reports the “Add conditional format” flow is blocked/broken.

#### Must‑match behaviors (checklist — what we will copy/implement)
- [x] **Sheet view-state persistence** (Luckysheet-style):
  - [x] Column widths persist across reload
  - [x] Row heights persist across reload
  - [x] New sheets created by the app include `viewState` defaults (so persistence is always structurally available)
  - [ ] **Cell formatting persists** (must round-trip on open → edit → save → reopen):
    - [ ] Bold
    - [ ] Italic
    - [ ] Underline
    - [ ] Strikethrough
    - [ ] Text color
    - [ ] Fill/background color
    - [ ] Font family + font size
    - [ ] Horizontal + vertical alignment
    - [ ] Number formats (continue persisting `ct` / display format)
    - [ ] Borders (if present in Luckysheet cell model; persist as-is)
    - [ ] Conditional formatting continues to round-trip (already implemented; keep it working)
    - [ ] Conditional formatting can be **added/edited via UI** (rule editor opens, rule is created, and it persists on reopen)
  - [ ] Persisted state is **round-trip safe** (open → edit → save → reopen preserves)
- [x] **Sheet stability (fail-soft)**:
  - [x] If Luckysheet scripts fail to load/initialize, show a deterministic error state (not a broken blank sheet)
  - [x] Provide a safe retry (re-init) path without requiring app restart
  - [x] Automation-safe: Retry control has a stable `testIds` selector (`testIds.spreadsheet.retryInit`)
  - [ ] Avoid duplicate initialization / stale global script states
- [x] **Spreadsheet MCP “authoring” guidance (LLM should not guess `.is`)**:
  - [ ] Add a `spreadsheet.get_schema` (or equivalent) tool that returns schema version + minimal canonical examples (currently unreliable / not discoverable in app)
  - [x] `get_sheet_data_for_rag` best-effort loads real `.is` content to expose formulas/structure (fail-soft)
  - [ ] Add tool-driven create/open/read/write surface (see `docs/MCP/SPREADSHEET_MCP_CONTRACT.md`)
  - [ ] Update system prompt/tool descriptions so the LLM prefers spreadsheet tools over hand-writing `.is` JSON

#### Explicit non‑goals (separate work)
- Full Excel parity (charts, pivot tables, full formatting suite)
- Collaborative editing
- Replacing Luckysheet with a different spreadsheet engine (unless we explicitly decide to migrate later)

#### Repo touch points (planned)
- Renderer:
  - `src/extensions/spreadsheet/SpreadsheetViewer.tsx` (capture/apply view-state + harden init)
  - `src/extensions/spreadsheet/actions/createSpreadsheet.ts` (ensure new-sheet defaults include required persisted keys/versioning)
- MCP server:
  - `mcp-servers/spreadsheet-server/server.py` (expand beyond formula calc + RAG stub; add authoring tools or proxy to renderer schema)
  - `docs/MCP/SPREADSHEET_MCP_CONTRACT.md` (align tool surface + examples)
- Automation:
  - `src/testing/testIds.ts` (stable selectors for spreadsheet UI state probes)
  - `tests/automation-smoke-ui.mjs` (deterministic proof of persistence + stability)

#### Proof (deterministic smoke)
- [x] View-state persistence proof: open a seeded `.is` sheet → adjust column width/row height → save → assert persisted values round-trip in `.is` (smoke-covered; selector-only).
- [ ] Create a new sheet (via UI action) → open it reliably (no blank/failed init).
- [ ] MCP: `spreadsheet.get_schema` is advertised and returns canonical schema + example(s).
- [x] View-state: open a `.is` sheet with `viewState` → assert Luckysheet config applies it and file contains the persisted values.
- [x] Unit test: `mcp-servers/spreadsheet-server/test_server.py` covers `tools/list` + `tools/call` for `spreadsheet.get_schema`.
- [ ] Formatting: set a cell’s formatting (bold + colors at minimum) → save → reopen → assert formatting still present in `.is` and applied in Luckysheet runtime.
- [ ] Conditional formatting (UI): add a rule via the UI → save → reopen → assert rule still present and applied.
