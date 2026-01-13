### Reference Map — **Views / Layout (Primary Side Bar parity)**

#### Upstream reference
- **VS Code user interface layout**:
  - `vscode-docs/docs/getstarted/userinterface.md` (Primary Side Bar, Activity Bar, Panel; basic layout mental model)
- **VS Code custom layout + persistence**:
  - `vscode-docs/docs/configure/custom-layout.md` (layout customization + “VS Code will remember the layout … across your sessions”)
- **VS Code UX guidelines (containers + views)**:
  - `vscode-docs/api/ux-guidelines/overview.md` (Activity Bar ↔ Primary Sidebar coupling)
  - `vscode-docs/api/ux-guidelines/sidebars.md` (Primary Sidebar concepts + view container toolbars)
  - `vscode-docs/api/ux-guidelines/views.md` (Views as containers that appear in Sidebar/Panel)

#### Must‑match behaviors (targeting the reported bugs)
- **No off-screen layout**:
  - The Primary Side Bar area must never “slide off” the viewport.
  - Horizontal overflow must be prevented (no “content pushes the sidebar wider than intended”).
- **Constrained-space behavior**:
  - When vertical space is constrained, the sidebar should **scroll** rather than pushing content off-screen.
  - Resizing a view section must clamp to available space (and never create negative/NaN sizes).
- **Collapsed views dock to bottom (stack behavior)**:
  - When the **lowest** view is collapsed, its header should **drop to the bottom** of the sidebar (no “floating in the middle” with dead space below).
  - Expanding an upper view must **not** push the bottom-most (collapsed or expanded) view off-screen; the layout must either reallocate space deterministically or use vertical scrolling.
- **Collapse model**:
  - Collapsing a view hides its content and leaves only the header row visible.
  - Collapsed/expanded state is persisted per project (via partition-scoped storage).
- **Resizer behavior**:
  - Resizer drag handles should be usable and deterministic; dragging should not cause “jump to max” or “jump to 0”.
  - Resizing one view should not cause unrelated views to disappear.
- **Activity Bar ↔ Side Bar coupling (minimal)**:
  - Clicking an Activity Bar item switches the active “workbench/view container” and shows its views in the sidebar.

#### Explicit non‑goals (for this bug-fix pass)
- Implementing full VS Code “view moving” (drag views between containers / secondary sidebar).
- Implementing Panel placement commands (left/right/top/bottom) or maximize behaviors.
- Implementing a full “Customize Layout” quick pick.

#### Repo touch points (expected)
- Sidebar container + stacked views layout: `src/App.tsx`
- Persisted layout state (widths/heights/collapsed): `src/store/layoutStore.ts` (`insightlm-layout-storage`)
- View header + collapse UI: `src/components/CollapsibleView.tsx`
- Drag resizing: `src/components/ResizablePane.tsx`
- Activity Bar selection: `src/components/ActivityBar.tsx`
- Deterministic proof: `tests/automation-smoke-ui.mjs` (CDP, selector-based)

#### Proof (deterministic)
- Add/extend a smoke step that:
  - Sets a small viewport size.
  - Toggles each sidebar view collapsed/expanded using `data-testid` on headers.
  - Asserts the sidebar container does not overflow horizontally (no horizontal scroll / widths stay within viewport).
  - Asserts collapsed views render only headers (no content area height).
