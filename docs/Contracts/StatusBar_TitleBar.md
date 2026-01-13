### Reference Map — **Status Bar (bottom) + Title/Menu Bar (top chrome)** *(VS Code parity)*

This contract covers layout-chrome changes:
- Add a **VS Code-like Status Bar** at the bottom of the workbench.
- Move **Project** + **Scope** indicators into the Status Bar.
- **Top chrome decision (Windows)**: keep the **native OS menu bar** (no extra in-app menubar row), and add a **Help → About** item.

---

## Upstream reference (authoritative)

- **VS Code Docs — Workbench layout regions**
  - `docs/getstarted/userinterface.md` (Basic layout: Editor, Primary Side Bar, Activity Bar, Panel, **Status Bar**)
- **VS Code Docs — Title/Menu bar behavior (custom title bar)**
  - `docs/configure/custom-layout.md` (settings: `window.titleBarStyle`, `window.menuBarVisibility`, `window.menuStyle`)
  - `release-notes/v1_25.md` (custom title bar + menus on Windows/Linux via `window.titleBarStyle: "custom"`)
- **VS Code Docs — Status Bar UX**
  - `api/ux-guidelines/status-bar.md` (Status Bar purpose + left/right grouping guidance)

---

## Must‑match behaviors (MVP checklist — what we will copy)

### A) Status Bar (bottom)
- [x] **A1. Always visible + pinned**: a single-row Status Bar is pinned to the bottom of the workbench (never scrolls away).
- [x] **A2. Two groups** (VS Code model):
  - **Left (Primary)**: workspace-scoped items (Project + Scope).
  - **Right (Secondary)**: file-scoped items (out of scope for this pass; leave empty or reserve area).
- [x] **A3. Project indicator**:
  - Shows the active Project name (and optionally location in tooltip).
  - Clicking it is either no-op or opens “Project” actions (explicitly defined; no surprise).
- [x] **A4. Scope indicator**:
  - Shows `SCOPED` vs `ALL (Project)` deterministically.
  - Clicking toggles scope mode (same behavior as current scope toggle).
  - Includes a stable “Jump to Contexts” affordance (direct click or adjacent item).
- [x] **A5. Deterministic + automation-safe**:
  - All status bar items have stable `data-testid`s via `src/testing/testIds.ts`.

### B) Top chrome (native menu bar — MVP)
- [x] **B1. Native menu bar**: use the OS-provided menu bar (no redundant in-app menubar row).
- [x] **B2. Help menu**: add **Help → About** (shows version + current Project data dir).
- [ ] **B3. Custom/frameless title bar (Option 1)**: out of scope for this pass.

---

## Explicit non‑goals (this pass)

- Full VS Code “Command Center” / global search in the title bar.
- Full panel docking/secondary sidebar moves.
- Full status bar ecosystem (problems, git, line/col, encoding, etc.).
- Reworking Chat UX beyond relocating scope + context indicators.

---

## Repo touch points (expected)

- Layout shell: `src/App.tsx` (move Project/Scope out of sidebar header; add top bar + status bar regions)
- Activity bar (left nav): `src/components/ActivityBar.tsx`
- Test ids: `src/testing/testIds.ts`
- Deterministic proof: `tests/automation-smoke-ui.mjs`
- Electron window chrome (only if **Option 1**): `electron/main.ts` (BrowserWindow options) and related CSS for drag regions

---

## Proof (deterministic smoke)

- [x] **Status bar exists**: assert `data-testid="statusbar-container"` is present and pinned (no scroll coupling).
- [x] **Project + Scope moved**: Status Bar contains both and scope toggles stay in sync (Status Bar + Contexts header) (`tests/automation-smoke-ui.mjs`).
- [x] **Scope toggle works**: click status bar scope toggle → assert mode flips and Contexts header indicator stays in sync (`tests/automation-smoke-ui.mjs`).
- [ ] **Menu opens/closes deterministically (automation)**: native OS menu is not reliably automatable via DOM selectors (manual check only).

---

## Decision (record)
- We chose the **native OS menu bar** for MVP (no in-app menubar row). We added **Help → About**.
