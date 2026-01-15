### Reference Map — **Tabbed UX: Editor Groups + Docking/Splits (VS Code parity)** *(contract; no code changes yet)*

#### Upstream reference (authoritative)
- **VS Code Docs**
  - **Editor groups (split editors)**: `docs/getstarted/userinterface.md` (editor groups; split/open to side)
  - **Custom layout / panel positioning**: `docs/configure/custom-layout.md`
    - Commands: `workbench.action.positionPanelLeft|Right|Bottom|Top`
  - **Tabs / Close semantics**:
    - `docs/getstarted/userinterface.md` (tabs + editor groups mental model)
    - VS Code release notes: tab title context menu contributions (`editor/title/context`) and split-in-group commands (`workbench.action.splitEditorInGroup`, etc.)

#### Must‑match behaviors (checklist — what we will copy)
- [x] **Editor groups**: split the editor area into multiple groups (vertical + horizontal).
- [x] **Tabs per group**: each group has its own tab strip; switching tabs doesn’t collapse other groups.
- [x] **Move tabs between groups** (command-driven is sufficient for MVP).
- [ ] **Open to the side** (create a new group + move/open tab there).
- [ ] **Dockable Chat**:
  - [x] Chat can be shown as a **sidebar view** and as an **editor tab**
  - [ ] Chat can be docked to a VS Code-style **panel region** (bottom/right/left/top) without breaking existing tabs
- [x] **Persistence (renderer reload)**: split layout persists across `View → Reload` / renderer reload.
- [ ] **Unsaved close protection**:
  - [x] Closing a dirty tab prompts deterministically: **Save / Don’t Save / Cancel**
  - [x] Bulk closes (Close All / Close Others / Close Saved) handle dirty tabs deterministically (batch prompt; fail-soft)
- [ ] **Live refresh on external writes (“file changed on disk”)**:
  - [x] If an **open tab’s underlying file changes on disk** (including changes made by **Chat/tools/LLM**), the tab **auto-refreshes** if it is **not dirty**.
  - [ ] If the tab **is dirty**, we **never stomp user edits**; instead we keep the current content and show a **non-blocking info toast** indicating reload was skipped.
  - [ ] This behavior is **deterministic** and does not require closing/reopening the tab.

#### Explicit non‑goals (for this pass)
- Full command palette parity
- Remote dev / multi-root workspaces

#### Repo touch points (planned)
- `src/App.tsx` / layout shell (workbench regions)
- `src/store/layoutStore.ts` + tab/document store (groups + docking persistence)
- `src/components/DocumentViewer/*` (tabs per group)
- Tab close confirm UI: `src/components/ConfirmDialog.tsx` (or existing dialog primitives) + `src/components/DocumentViewer/DocumentViewer.tsx`
- Live-refresh plumbing:
  - `electron/ipc/files.ts` + `electron/ipc/workbooks.ts` (canonical broadcaster of `insightlm:workbooks:filesChanged`)
  - `electron/services/llmService.ts` (ensure tool-driven writes emit the same broadcast)
  - `src/App.tsx` + `src/store/documentStore.ts` (refresh open documents on event; skip dirty)
- `tests/automation-smoke-ui.mjs` (deterministic smoke: split groups + move tab + dock Chat)

#### Proof (deterministic smoke)
- [x] Open 2 docs → split editor → assert both groups visible with independent tabs. (`tests/automation-smoke-ui.mjs`)
- [x] Move a tab to the other group → assert it appears there. (`tests/automation-smoke-ui.mjs`)
- [ ] Dock Chat to panel/sidecar → assert Chat stays visible while tabs remain navigable.
- [x] Dirty tab close → prompt appears → Cancel keeps tab open, Don’t Save closes, Save persists then closes. (`tests/automation-smoke-ui.mjs`)
- [x] Open a document tab → trigger a **main-process tool-style write** to that same file → assert the **open tab refreshes without closing**.
- [ ] Make the tab dirty (edit without saving) → trigger the same write → assert tab content does **not** auto-reload and an **info toast** appears.

---

## Reference Map addendum — **Editor splits (2 groups) for “Chat + Doc side-by-side”**

#### Upstream reference (authoritative)
- `vscode-docs/docs/getstarted/userinterface.md`:
  - **Editor groups** mental model (“split editor”, “open to the side”).
  - Setting: `workbench.editor.openSideBySideDirection` (right vs down).
- `vscode-docs/release-notes/v1_61.md`:
  - Split editor commands and layout setting (`workbench.editor.splitInGroupLayout`).

#### Must‑match behaviors (MVP)
- **Two editor groups** in the editor area.
- **Split Right** and **Split Down** actions create/activate the second group.
- **Chat tab + Document tab simultaneously visible** (user can compare while working).
- **Independent tab strips** per group (active tab in one group doesn’t change the other).
- **Resizable split** between the two groups (deterministic; no layout “jumping”).

#### Explicit non‑goals (first pass)
- More than 2 groups.
- Drag/drop tabs between groups (command/menu “Move to other group” is enough for MVP).
- Full VS Code grid layout / panel docking parity.

#### Repo touch points (expected)
- `src/components/DocumentViewer/DocumentViewer.tsx` (render two groups + resizer + menu actions)
- `src/store/documentStore.ts` (group assignment + move-to-group)
- `src/testing/testIds.ts` (stable ids for split controls + group containers)
- `tests/automation-smoke-ui.mjs` (proof)

#### Proof (deterministic smoke)
- Open a document, open Chat as a tab, trigger **Split Right**, then **move Chat to the other group**.
- Assert both groups are visible and **each shows its active content**.
