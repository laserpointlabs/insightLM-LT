# Projects (Workspace Parity) — InsightLM‑LT

## Goal

Add a first‑class **Project** concept so a user can **create/open/switch** “workbenches” (e.g., *Electronics*, *Mechatronics*, *HIL*) where all relevant state lives together: views, tabs, chats, contexts, workbooks, dashboards, settings.

## Upstream reference (VS Code)

VS Code’s “project” concept is effectively a **Workspace**:
- A workspace is the collection of one or more folders opened in a window/instance. (VS Code docs: “What is a workspace?”)
- Multi-root workspace files (`.code-workspace`) store folder list + workspace settings. (VS Code docs: multi-root workspaces)

## Proposed mapping in InsightLM‑LT

- **Project == Workspace**
  - A Project can reference **multiple workbooks** (and other resources).
  - A Project has **project-scoped state** (layout, open tabs, chat drafts, etc.).

## Must-have behaviors (MVP)

- **File → New Project…**: create an empty project (name + storage location).
- **File → Open Project…**: open an existing project.
- **File → Open Recent**: list recent projects (deterministic ordering).
- **Project-scoped persistence** (never global by accident):
  - layout/view state
  - open tabs + active tab
  - chat thread(s) + drafts
  - active context / scoping mode (if applicable)
- **Export/Import project** (optional for MVP, but plan for it): portable bundle later.

## Explicit non-goals (for now)

- Team collaboration, cloud sync, permissions, multi-user concurrency.
- Cross-project global search/indexing.

## Implementation notes (where it likely lands)

- Add a Project/Workspace store (parallel to `layoutStore` / `workbenchStore`) with a single “currentProjectId/path”.
- Persist state under a **project-keyed** namespace (instead of global `localStorage` keys).
- Add menu entries in the Electron shell (File menu) to create/open recent.
