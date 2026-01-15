# Extension System — Full Decoupling Plan (including “core” extensions)

## Purpose

Make the app’s extension system **truly decoupled** so that:

- The **core app** does not import/compile extension code (UI or backend) directly.
- Even “core/bundled” extensions (e.g., Jupyter) are treated as **extensions**, loaded the same way as any other.
- Enabling/disabling is **deterministic** and **fail‑soft** (extension failures do not break the shell).
- The system supports two distribution types:
  - **Bundled extensions** shipped with the app (still decoupled)
  - **External extensions** installed post-build (optional; can be deferred)

## Current state (reality check)

### What is already good

- There is a renderer-side `ExtensionRegistry` (`src/services/extensionRegistry.ts`) with a manifest model and contribution points (file handlers, commands, workbook actions, etc.).
- Enable/disable state exists (stored in `localStorage` today).
- There is a fail-soft lifecycle call to main for MCP servers: `window.electronAPI.extensions.setEnabled(...)`, handled by `ipcMain.handle("extensions:setEnabled", ...)` in `electron/main.ts`.
- There is an Extensions UI (`src/components/Extensions/ExtensionsWorkbench.tsx`).

### What is not decoupled today

- Extensions are **hard-registered from core UI** in `src/App.tsx`:
  - `extensionRegistry.register(jupyterExtensionManifest)`
  - `extensionRegistry.register(spreadsheetExtensionManifest)`
- Extension UI code lives under `src/extensions/...` and therefore is built into the core renderer bundle.
- “Two extensions only” still means **core is coupled** if core imports their manifests/components.

## Definitions (what “decoupled” means here)

### Hard rule 1: No core imports of extension modules

Core code must not do:

- `import { jupyterExtensionManifest } from "./extensions/jupyter";`
- `import("./extensions/...")` with static bundler inclusion

Core may only:

- Discover *extension metadata* (manifest) via filesystem (main) or fetch call (renderer) provided by core.
- Load extension UI bundles via **runtime module loading** (dynamic import of external module URL).

### Hard rule 2: “Bundled” is not the same as “coupled”

Bundled extensions can ship inside the app distribution, but they must still be:

- Built as separate bundles
- Loaded through the same discovery + activation path
- Removable/disableable without changing core code

### Hard rule 3: Fail-soft everywhere

- Extension load failure → shell continues; extension shown as errored/disabled.
- MCP server start failure → toast + extension remains visible; UI remains responsive.

## Target architecture (high level)

### Split responsibilities (main vs renderer)

**Main process responsibilities**

- Find extension installations (bundled + external).
- Validate/parse `manifest.json` files.
- Provide the renderer a list of extension manifests (read-only).
- Manage extension-scoped backend processes (MCP servers) as needed.
- Persist enable/disable state (project-scoped, disk-backed).

**Renderer responsibilities**

- Present Extensions UI (list/details/toggle).
- Render extension-contributed UI by loading extension bundles at runtime.
- Route user actions to extension contributions (commands, file handlers, workbook actions).

### Extension packaging model

Each extension is a directory with:

- `manifest.json` (authoritative metadata + contributions)
- optional `renderer/` bundle (UI)
- optional `mcp-server/` (backend)

Example layout:

```
<extensionsRoot>/<extensionId>/
  manifest.json
  renderer/
    dist/index.js
  mcp-server/
    server.py
    requirements.txt
    config.json (optional)
```

**Bundled extensions** live under a known app path (e.g. `<app>/resources/extensions/`).
**External extensions** live under a user path (e.g. `%APPDATA%/insightLM-LT/extensions/`).

## Manifest contract (minimum)

### `manifest.json` fields (minimum)

- `id`, `name`, `version`, `description`
- `publisher` / `author` (optional)
- `contributes`:
  - `fileHandlers[]` (optional)
  - `commands[]` (optional)
  - `workbookActions[]` (optional)
  - `contextProviders[]` (optional)
- `ui` (optional):
  - `entry`: path to JS module (e.g. `renderer/dist/index.js`)
- `mcpServer` (optional):
  - `name`, `command`, `args`, `env`, `serverPath`

Key constraint: core must treat the manifest as **data**, not code.

## Loading model (end-to-end)

### 1) Discovery (main)

On app start (and optionally on demand), main:

- Scans bundled + external extension roots.
- For each `<extensionId>/manifest.json`:
  - parse JSON
  - validate schema
  - normalize paths (absolute paths for renderer `ui.entry` and for `mcpServer.serverPath`)

Main exposes:

- `electronAPI.extensions.list(): ExtensionManifest[]`
- `electronAPI.extensions.get(id): ExtensionManifest | null`

### 2) State + enablement (main is source of truth)

Enablement should be stored **project-scoped** (disk-backed) rather than `localStorage`:

- `electronAPI.extensions.getState(): { enabledById: Record<string, boolean> }`
- `electronAPI.extensions.setEnabled(id, enabled): ...`

Renderer should not decide enablement; it requests a change; main persists it.

### 3) Activation (renderer)

Renderer:

- Fetches manifests + enablement state from `electronAPI.extensions.*`.
- Populates `ExtensionRegistry` with **manifest data only**.
- For each enabled extension:
  - If `mcpServer` exists → renderer asks main to start/stop (or main auto-starts on enable).
  - If UI bundle exists → renderer lazy-loads UI entry only when needed.

### 4) Runtime UI module loading (decoupled UI)

Instead of compiling extension React components into the core bundle, load them at runtime:

- Extension UI bundle exports a known surface, e.g.:
  - `register(registry: ExtensionRegistryApi): void`
  - OR exports concrete components referenced by manifest contribution IDs

Core renderer loads:

- `import(/* @vite-ignore */ fileUrlToModuleUrl(manifest.ui.entry))`

Important: this requires a deliberate bundling strategy so that extension bundles do not get inlined by Vite into the core build.

## Extension API boundary (keep it narrow)

Expose a small, stable host API to extensions:

### Renderer-side API (safe)

- register file handlers (by id)
- register commands (by id)
- register workbook actions
- request file read/write via existing `electronAPI.file.*`
- request MCP call via existing `electronAPI.mcp.call(...)` (or an extension-scoped call wrapper)

### Main-side API (safe)

Extensions should not get raw Node/Electron primitives.
They can:

- start/stop their own MCP server process (host controlled)
- call host file operations through IPC

## Decoupling “core extensions” (Jupyter/Spreadsheet) the right way

Treat Jupyter/Spreadsheet as “bundled extensions”:

- Move them out of `src/extensions/*` into an extension package layout (`extensions/<id>/...`) that is built separately.
- Core no longer imports their manifests or components.
- They appear in Extensions UI as “bundled”.

This lets you keep “only two extensions shipped” while still achieving decoupling.

## Known coupling pressure points (and how to resolve)

### 1) File handler selection is extension-based only by suffix

Current viewer chooses handler by `getFileExtension(filename)` (single suffix) + `priority`.

To remain decoupled:

- Prefer dedicated file extensions for extension-owned viewers (e.g., `.ipynb`, `.is`, `.slides`).
- If you want content-based routing (e.g., `.md` + frontmatter), that is a core routing feature and should be treated as a deliberate core capability (not extension-only).

### 2) Persistence location

Today enablement is stored in renderer `localStorage`.

For full decoupling and determinism:

- Store enablement in the project’s disk-backed state (similar to `projectState`), managed by main.

### 3) Extension discovery vs build system

Docs already describe “scan `extensions/` and load `manifest.json`” (e.g., `docs/MCP/extension-mcp-server-bundling.md`), but the running code does not do it yet.

This plan makes that the real source of truth.

## Migration plan (incremental, low-risk)

### Phase 0 — Stop importing extensions from core

- Remove direct registration in `src/App.tsx`.
- Replace with a “load manifests from main” bootstrap step.

### Phase 1 — Implement extension discovery in main + list API

- Implement filesystem scan of bundled extensions directory first.
- Provide IPC APIs:
  - `extensions:list`
  - `extensions:getState`
  - `extensions:setEnabled`

### Phase 2 — Convert existing extensions to bundled packages

- Package Jupyter + Spreadsheet into separate extension dirs with `manifest.json`.
- Ensure UI loads through runtime module loading, not through core imports.
- Ensure their MCP servers (if any) use extension-owned paths.

### Phase 3 — Optional: support external install directory

- Add second scan root (`%APPDATA%/.../extensions`).
- Add “Install from folder/zip” later if desired.

## Testing requirements (automation-friendly)

Minimum deterministic checks (UI-level):

- Extensions list renders even if one extension’s UI bundle fails.
- Toggling an extension updates:
  - enablement state
  - MCP server process lifecycle (if present)
- Opening an extension-contributed file handler works for a dedicated file extension.

## Security + policy notes (pragmatic baseline)

If/when external extensions are supported:

- Start with **allowlist** (bundled only), then add signed manifests later.
- Never execute arbitrary code in the renderer without explicit installation trust.
- Keep MCP servers isolated as separate OS processes (already aligned with MCP).

## Summary

To become “fully decoupled,” the system must move from:

- **compiled-in extension modules** registered in `src/App.tsx`

to:

- **manifest-driven discovery** in main, and
- **runtime module loading** of extension UI, and
- **main-owned state/lifecycle** for enablement + MCP servers,

so that even “core” features like Jupyter can ship as bundled extensions without coupling the shell to their implementation.

