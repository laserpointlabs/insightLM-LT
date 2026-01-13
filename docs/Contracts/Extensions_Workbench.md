### Reference Map — **Extensions Workbench (Activity Bar + Sidebar list + Details tab)** *(VS Code parity; new workbench surface)*

This contract brings back “Extensions” as a first‑class workbench surface:
- A new **Extensions** icon in the left **Activity Bar** (below the Insight/File workbench icon).
- Clicking it opens an **Extensions Workbench** (like the existing Data/Analysis/Event workbenches).
- The workbench lists registered extensions with:
  - A **checkbox** to enable/disable.
  - A **clickable tile/row** that opens a **Details tab** describing the extension.

---

## Upstream reference (authoritative; do not invent UX)

- **VS Code Docs — Extensions view location**
  - `docs/configure/extensions/extension-marketplace.md`
    - “Bring up the Extensions view by clicking on the Extensions icon in the **Activity Bar** … or the **View: Extensions** command (`kb(workbench.view.extensions)`).”
- **VS Code Docs — Activity Bar / View Containers mental model**
  - `docs/getstarted/userinterface.md` (Activity Bar + Primary Side Bar regions)
  - `api/ux-guidelines/overview.md` (Activity Bar is a core navigation surface)
  - `api/references/contribution-points.md` (`contributes.viewsContainers` → Activity Bar containers)

---

## Must‑match behaviors (MVP checklist)

### A) Activity Bar integration
- [x] **A1. New icon**: Add an **Extensions** icon to the Activity Bar.
- [x] **A2. Stable position**: The Extensions icon is **directly below** the Insight/File workbench icon (does not reorder across runs).
- [x] **A3. Selection model**: Clicking Extensions sets the active workbench to **Extensions** (same model as other workbenches).
- [x] **A4. Automation-safe**: Activity Bar item uses centralized `testIds` (no inline strings).

### B) Extensions Workbench (Sidebar surface)
- [x] **B1. List registered extensions**: show all manifests from the repo’s `extensionRegistry`.
- [x] **B2. Enable/disable checkbox**:
  - Toggling updates the enabled state deterministically (no laggy/unclear state).
  - Must remain **fail-soft**: if the backend cannot start/stop an extension-managed server, UI stays usable and shows a non-blocking error toast.
- [x] **B3. Click opens details**:
  - Clicking an extension row/tile opens a **tab** in the editor area showing extension details.
  - The tab title is the extension name (or a deterministic fallback).
- [x] **B4. Empty state**:
  - If no extensions are registered, show an explicit empty state (“No extensions registered”).
- [x] **B5. Automation-safe selectors**:
  - Each extension row/tile has a stable `data-testid`.
  - Each enable checkbox has a stable `data-testid`.

### C) Extension Details tab (Editor)
- [x] **C0. Decoupled tab ownership**:
  - The details tab is **extension-owned data**: it renders from the extension’s manifest (and optional extension-provided details view).
  - Core must not hardcode per-extension fields or special cases (no coupling to “Jupyter” / “Spreadsheet”).
- [x] **C1. Deterministic content (manifest-driven)**: show at least:
  - Name, id, version, description
  - Whether it is enabled/disabled
  - If it has an MCP server contribution: server name + command + args (safe display only)
- [x] **C2. No side effects on open**: opening details never enables/disables anything.
- [ ] **C3. Optional extension-provided tab UI (decoupled)**:
  - If an extension contributes a `views` item with `id: "extension.details"` (or similar) we may render it inside the details tab.
  - Fail-soft: if that component fails to load/render, fall back to the manifest-driven details view.

---

## Explicit non‑goals (this pass)

- Installing/uninstalling extensions from a marketplace.
- Searching/downloading VSIX.
- VS Code’s full Extensions view grouping (Enabled/Disabled/Recommended) beyond the simple list we need.
- Rich “extension detail webview” parity (ratings, changelog, README rendering).

---

## Repo touch points (expected)

- Activity Bar: `src/components/ActivityBar.tsx`
- Workbench model: `src/store/workbenchStore.ts` (add `extensions` workbench id + icon)
- Extensions list UI: new `src/components/Extensions/ExtensionsWorkbench.tsx` (or similar)
- Extension source of truth: `src/services/extensionRegistry.ts`
- Enable/disable IPC: `electron/main.ts` + `electron/preload.ts` (`electronAPI.extensions.setEnabled`)
- Tab opening: `src/store/documentStore.ts` + `src/components/DocumentViewer/DocumentViewer.tsx` (new tab type for extension details)
- Stable selectors: `src/testing/testIds.ts`
- Deterministic proof: `tests/automation-smoke-ui.mjs`

---

## Proof (deterministic smoke)

- [x] Open Extensions workbench via Activity Bar and assert list renders:
  - `button[data-testid="activitybar-item-extensions"]` → list container visible.
  - Assert at least the built-in registered extensions appear (Jupyter + Spreadsheet).
- [x] Toggle one extension enabled state via checkbox and assert UI reflects the change.
- [x] Click an extension tile and assert a details tab opens and contains the extension name/id.

---

## Decisions (record)

1) **Details tab location**: **Main editor tabs**.
2) **Disable semantics**: **Best-effort start/stop server** via `electronAPI.extensions.setEnabled` (fail-soft).
3) **Custom details UI**: **Not implemented yet** (tracked by C3).
