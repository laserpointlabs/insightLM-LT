### Reference Map — **Projects (Workspaces) + Git‑lite (local)**

#### Upstream reference
- **VS Code**: Workspace model (“Open Folder/Workspace”, “Open Recent”).
  - `vscode.openFolder` command docs (Context7: `/microsoft/vscode-docs`)
- **VS Code**: Source Control (SCM) UX concepts (changes list + commit input box).
  - SCM provider + input box docs (Context7: `/microsoft/vscode-docs`)

#### Must‑match behaviors (MVP checklist)
- [x] **Project = Workspace**: user can create/open/switch “workbenches”.
- [x] **File menu parity (minimal)**:
  - [x] File → **New Project…** (name + location)
  - [x] File → **Open Project…**
  - [x] File → **Open Recent** (deterministic order)
- [x] **Project‑scoped persistence** (never global by accident):
  - [x] layout/view collapse state (localStorage, project-scoped via per-project session partition)
  - [x] open tabs (localStorage, project-scoped via per-project session partition)
  - [x] active tab (disk-backed project state + restored on boot)
  - [x] chat drafts (disk‑backed under Project dataDir)
  - [x] chat threads (disk‑backed under Project dataDir, single-thread per context)
  - [x] contexts/scope mode (disk-backed project state + restored on boot)
- [ ] **Hard data access boundary**:
  - [ ] Chat/RAG/tools can only read/write inside the current Project data directory.
  - [x] Absolute paths + `..` traversal + symlink escape are rejected deterministically (workbook file boundary).

#### Git‑lite (local‑first) behaviors
- [x] Git‑lite is **scoped to the current Project** (no global repo surprise).
- [x] **Init**: initialize a repo in the Project data directory (or a designated project root).
- [x] **Status**: show changed/untracked files (working tree + staged).
- [x] **Diff**: show diffs for a file and for the repo (text-based; binary = “binary changed”).
- [x] **Commit**: commit staged changes with message (no amend/rebase for MVP).
- [x] **History**: show recent commits (hash, author, date, message).

#### Explicit non‑goals (for MVP)
- Remote GitHub/GHE auth, push/pull, PRs.
- Full VS Code SCM UI parity (staging UI, inline diff editor, etc.).
- Multi-root workspace support (can be later).

#### Repo touch points (expected)
- **Electron menu**: `electron/main.ts` includes explicit File → Project items (New/Open/Open Recent).
- **Data root**: `electron/services/configService.ts` + `electron/main.ts` `appConfig.dataDir` + `INSIGHTLM_DATA_DIR`.
- **Boundary enforcement**: `electron/services/fileService.ts` + MCP servers rooted under `INSIGHTLM_DATA_DIR` (see `docs/Standards/PROJECT_DATA_ACCESS_BOUNDARY.md`).
- **Renderer persistence**: several stores currently persist to global `localStorage` keys (e.g., `src/store/documentStore.ts`, `src/store/layoutStore.ts`, `src/store/chatDraftStore.ts`) → must become project-keyed.

#### Proof (deterministic)
- [ ] **Projects**:
  - [ ] Create Project → restart app → assert tabs/layout restored only for that project.
  - [x] Chat draft persists across restart in Project A (disk) and does not bleed into Project B (A→B→A proof in `tests/run-prod-renderer-smoke.mjs`).
  - [x] Active tab + scoping mode persist across restart in Project A and do not bleed into Project B (A→B→A proof in `tests/run-prod-renderer-smoke.mjs`).
- [ ] **Boundary**:
  - [x] Attempt tool read with `../` traversal → deterministic “not allowed” (unit test).
- [ ] **Git‑lite**:
  - [x] Init → create file → status shows change → commit → history shows commit (UI smoke).

#### Manual verification (closing-out checklist)
- **Git is installed (required)**:
  - In PowerShell:
    - `git --version`
    - `where.exe git` (or `Get-Command git`)
  - If `git` isn’t found, install **Git for Windows** and make sure it’s on your PATH (then restart the terminal / app).

- **Automated proof (fast + repeatable)**:
  - Run: `npm run smoke:run`
  - In the output, you should see:
    - Project persistence harness: **A→B→A** proof lines (from `tests/run-prod-renderer-smoke.mjs`)
    - `✅ Verified Git-lite init/status/commit/log (local, deterministic)` (from `tests/automation-smoke-ui.mjs`)

- **Manual proof (without running the full smoke)**:
  - Open the app, then open DevTools via **View → Toggle Developer Tools** (provided by Electron `viewMenu`).
  - In the DevTools Console, run:

```javascript
// Git-lite (scoped to current Project dataDir)
await window.electronAPI.git.init()
await window.electronAPI.git.status()
await window.electronAPI.git.commit("manual: git-lite smoke " + Date.now())
await window.electronAPI.git.log(5)
```

- **Where the repo lives on disk (and why you might not “see it”)**:
  - Git-lite runs `git` in the **current Project dataDir** (repo root = dataDir).
  - After `init`, Git creates a `.git` folder — **it’s hidden by default on Windows**.
    - To verify in PowerShell: `dir -Force <your dataDir>\.git`
