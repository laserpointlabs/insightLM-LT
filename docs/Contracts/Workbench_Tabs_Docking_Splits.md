### Reference Map — **Tabbed UX: Editor Groups + Docking/Splits (VS Code parity)** *(contract; no code changes yet)*

#### Upstream reference (authoritative)
- **VS Code Docs**
  - **Editor groups (split editors)**: `docs/getstarted/userinterface.md` (editor groups; split/open to side)
  - **Custom layout / panel positioning**: `docs/configure/custom-layout.md`
    - Commands: `workbench.action.positionPanelLeft|Right|Bottom|Top`

#### Must‑match behaviors (checklist — what we will copy)
- [ ] **Editor groups**: split the editor area into multiple groups (vertical + horizontal).
- [ ] **Tabs per group**: each group has its own tab strip; switching tabs doesn’t collapse other groups.
- [ ] **Move tabs between groups** (drag/drop or command-driven).
- [ ] **Open to the side** (create a new group + move/open tab there).
- [ ] **Dockable Chat**:
  - [ ] Chat can be shown as a **sidebar view** and as an **editor tab**
  - [ ] Chat can be docked to a VS Code-style **panel region** (bottom/right/left/top) without breaking existing tabs
- [ ] **Persistence**: group layout + open tabs persist per Project/Workspace.

#### Explicit non‑goals (for this pass)
- Full command palette parity
- Remote dev / multi-root workspaces

#### Repo touch points (planned)
- `src/App.tsx` / layout shell (workbench regions)
- `src/store/layoutStore.ts` + tab/document store (groups + docking persistence)
- `src/components/DocumentViewer/*` (tabs per group)
- `tests/automation-smoke-ui.mjs` (deterministic smoke: split groups + move tab + dock Chat)

#### Proof (deterministic smoke)
- [ ] Open 2 docs → split editor → assert both groups visible with independent tabs.
- [ ] Move a tab to the other group → assert it appears there.
- [ ] Dock Chat to panel/sidecar → assert Chat stays visible while tabs remain navigable.
