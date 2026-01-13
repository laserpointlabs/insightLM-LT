### Reference Map — **UI Bugs Round 1 (Views / Tabs / Chat / Context Controls)**

This contract is the **single checklist** for the current “30+ bugs” pass so we implement in **batches** (not one-at-a-time), with deterministic smoke coverage for each class of regression.

#### Upstream reference (do not invent UX)
- **Views / Layout / Side Bar (VS Code parity)**:
  - `vscode-docs/docs/getstarted/userinterface.md` (primary side bar mental model)
  - `vscode-docs/docs/configure/custom-layout.md` (persistence expectations)
  - `vscode-docs/api/ux-guidelines/overview.md`
  - `vscode-docs/api/ux-guidelines/sidebars.md`
  - `vscode-docs/api/ux-guidelines/views.md`
- **Editor / Tabs / Workbench (VS Code parity)**:
  - See `docs/Contracts/Workbench_Tabs_Docking_Splits.md` (this repo’s parity target doc; upstream references recorded there)
- **Chat UX (Continue/Cursor parity)**:
  - See `docs/Contracts/Chat_Composer.md`, `docs/Contracts/Chat_Response_UX.md`, `docs/Contracts/Chat_Edit_Rerun.md`

---

## Must‑match behaviors (MVP checklist)

### A) Primary Side Bar views (Dashboards / Contexts / Workbooks / Chat) — **no hopping / no disappearing**
- [ ] **A0. View order is stable (no reordering / no “jump to top”)**:
  - The vertical order is always: **Dashboards → Contexts → Workbooks → Chat**.
  - Expanding/collapsing any view must **not** reorder views or cause a view header to “jump” to the top unexpectedly.
- [ ] **A1. Expanded views never “disappear”**:
  - Repro we must fix: open **Dashboards + Contexts + Workbooks**, then expand **Chat** → **Workbooks must remain expanded** (not auto-collapsed, not unmounted, not pushed off-screen without scroll affordance).
- [ ] **A2. VS Code-style height allocation (“SplitView-ish”)**:
  - With **multiple expanded views**, the layout must remain stable and predictable.
  - At minimum: **the last expanded view grows to fill the remaining space**, and other expanded views are allowed to shrink (no hard `flex-shrink: 0` causing off-screen loss).
  - When **only one** of Dashboards/Contexts/Workbooks is expanded (above Chat), it fills the available area.
- [ ] **A3. Collapsed views dock to bottom**:
  - Collapsing the lowest view header drops to the bottom; expanding upper views must not push bottom headers off-screen.
- [ ] **A4. Constrained space behavior is scroll-first**:
  - If the sidebar can’t fit all expanded view content, the sidebar uses **vertical scrolling** (no off-screen headers with no scroll).
- [ ] **A5. No horizontal overflow**:
  - Sidebar never shows a horizontal scrollbar; long rows truncate/wrap deterministically.
- [ ] **A6. Resizers behave deterministically**:
  - Dragging a resizer doesn’t “jump to max/zero”.
  - Resizing one view does not cause unrelated views to collapse or disappear.
  - Resizer handles are always available **between adjacent expanded views** (even if a middle view is collapsed):
    - Example: if **Dashboards** and **Workbooks** are expanded while **Contexts** is collapsed, you must still be able to resize the boundary between the two expanded views.
  - Opening/closing **Chat** must not “break” the ability to resize other expanded views.
- [ ] **A8. Workbooks view live updates correctly**:
  - Workbooks tree/list reflects changes without requiring manual refresh (create/rename/move/delete/import; and when switching contexts/workbooks where applicable).
  - If there is an intentional refresh trigger, it must be deterministic and obvious (no “stale UI”).
  - Explicit repro to fix: **create/import a workbook** → it must appear in Workbooks without needing **View → Reload**.
- [ ] **A9. Contexts view live updates correctly**:
  - Contexts list/active context UI reflects changes without requiring manual refresh.
  - Explicit repro to fix: add a new workbook (or change context membership) and the Contexts view must reflect it without needing **View → Reload**.
- [ ] **A7. Persistence (per-project)**:
  - Collapsed/expanded state and sizes persist per project (partition-scoped).

### B) Tabs / Editor area (VS Code parity)
- [ ] **B1. Tabs never overflow off-screen without controls**:
  - If too many tabs: deterministic overflow handling (scroll buttons / wrapping rules / truncation) per the parity doc.
- [ ] **B2. Opening “Chat as a tab” does not break layout**:
  - Bug in `TODO.md` item **2** must be resolved: opening Chat in a tabbed layout must not collapse/force-close the left column view.
- [ ] **B3. Active tab stability**:
  - Saving a file keeps the current tab active (already fixed; must not regress).
- [ ] **B4. Unsaved changes are protected on tab close**:
  - Closing a dirty tab must prompt deterministically: **Save / Don’t Save / Cancel** (no silent data loss).
  - “Close All” style actions must also honor dirty tabs (batch prompt or per-tab prompt; deterministic).
- [ ] **B5. Tab context menu (VS Code-style basics)**:
  - Right click tab → Close / Close Others / Close Saved / Close All (final set to match VS Code references).
  - Must be automation-safe (`testIds`) and keyboard/mouse deterministic.
- [ ] **B6. Editor splits / groups (Chat + Document side-by-side)**:
  - Support viewing **Chat tab** and a **Document** simultaneously (split left/right or up/down).
  - VS Code parity: editor groups model (not ad-hoc floating panes).

### C) Chat UX (Continue/Cursor parity)
- [ ] **C1. “Thinking/streaming” indicator is single + correct** (no duplicates)
- [ ] **C2. Streaming output renders as Markdown progressively** (safe + deterministic)
- [ ] **C3. `@` mention insertion caret stability** (no offset)
- [ ] **C4. Clear empty/loading/error states** (no silent failures)
- [ ] **C5. Chat context picker is not confusing / no duplicate lists**:
  - Chat “Context” dropdown must not show the same workbook twice (e.g., Quick Workbooks plus `[WB] ...` contexts in the contexts list).
  - “Go to Contexts…” in the picker must reliably jump/expand the Contexts view (no “does nothing”).

### D) Context controls (scoping + “active context” indicator)
- [ ] **D1. Active context display is accurate + not noisy**:
  - No “too much context” / redundant labeling; matches contract targets.
- [ ] **D2. Scope indicators stay in sync**:
  - Main header + Contexts header show the same scoping mode deterministically.
- [ ] **D3. Context cards: workbook list is collapsible (VS Code section-style)**:
  - Context cards that include many workbooks must not dominate the view.
  - The workbook list inside each Context card can be expanded/collapsed, and the collapsed state persists per project.
- [ ] **D4. Chat context picker updates when Workbooks change (no full reload)**:
  - Creating/renaming/deleting a workbook updates the Chat “Context” dropdown’s **Quick: Workbooks** list immediately.
  - Must not require **View → Reload** to see a newly created workbook.
- [ ] **D5. Workbook CRUD cascades to Contexts + Active Context (no stale references)**:
  - **Delete workbook**:
    - The deleted workbook must disappear from all workbook lists immediately (Workbooks view + Chat context picker).
    - Any Context whose `workbook_ids` contains the deleted workbook must be updated to remove that id.
    - Any **single-workbook “quick” context** (e.g., `[WB] <name>` with exactly that workbook) must be deleted.
    - If the **active context** becomes invalid/empty after cascade, active context is cleared deterministically.
  - **Rename workbook**:
    - Context membership remains correct (IDs stable).
    - Any **single-workbook “quick” context name** should update to `[WB] <new workbook name>` (so active-context display stays accurate).

---

## Explicit non‑goals (this pass)
- Full VS Code view moving between containers (primary ↔ secondary sidebar, panel moves).
- Full editor group splits / drag-to-split / tab pinning unless explicitly marked in the Tabs contract as in-scope.
- Any new UI surface that isn’t required to fix the listed bugs.

---

## Repo touch points (expected)
- Sidebar layout + view stacking: `src/App.tsx`
- View header/collapse behavior: `src/components/CollapsibleView.tsx`
- Resizing behavior: `src/components/ResizablePane.tsx`
- Layout persistence: `src/store/layoutStore.ts`
- Tabs/editor behavior: `src/components/DocumentViewer/*`, `src/store/documentStore.ts`
- Stable selectors: `src/testing/testIds.ts`
- Deterministic proof: `tests/automation-smoke-ui.mjs` (+ possibly `tests/run-prod-renderer-smoke.mjs` for persistence proofs)

---

## Proof (deterministic smoke)

### 1) Sidebar “no disappearing / stable split sizing”
- [ ] In `tests/automation-smoke-ui.mjs`:
  - Set constrained viewport.
  - Expand **Dashboards**, **Contexts**, **Workbooks** (ensure all `aria-expanded=true`).
  - Expand **Chat**.
  - Assert **Workbooks still expanded** and its header + container are present.
  - Assert vertical scroll region is used when needed (no off-screen loss without scroll).

### 2) Multi-view sizing invariant
- [ ] With Dashboards + Contexts expanded:
  - Assert **Contexts grows** (or last-expanded grows) so there is no “dead space”.
  - Assert neither view collapses or becomes inaccessible.

### 3) No horizontal overflow (sidebar)
- [ ] Assert `scrollWidth <= clientWidth + epsilon` for `sidebar-container`.

### 4) Tabbed Chat does not collapse sidebar
- [ ] Repro TODO bug (2): open Chat into editor tabs and assert sidebar view(s) remain visible and unchanged.

---

## Current known failing reports to include (from you)
- [ ] “Open Dashboards + Contexts + Workbooks, then open Chat → Workbooks disappears.”
- [ ] “With Dashboards + Contexts, Context doesn’t fill; layout becomes partial/awkward.”
- [ ] “View order changes / a view disappears and jumps to the top; order must stay Dashboards → Contexts → Workbooks → Chat.”
- [ ] “Resizing gets messy: collapsing a middle view can make lower view(s) feel ‘stuck’ / can’t resize as expected; resizing must work between adjacent expanded views.”
- [ ] “Workbooks view does not auto-update; tree/list can go stale.”
- [ ] “Contexts view does not auto-update; changes require View → Reload.”
