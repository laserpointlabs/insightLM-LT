# InsightLM-LT — Windows Install / Setup Notes (for another computer)

This document captures the issues we hit during setup and the repo changes we made so a new Windows machine can install and run the app successfully.

---

## What we fixed (high level)

- **Node/npm not installed** → install Node.js LTS (includes npm).
- **Electron runtime missing** (`Electron failed to install correctly...`) → add a repair script to download/extract Electron runtime into `node_modules/electron/dist`.
- **App wouldn’t open due to EPERM** → remove hardcoded `C:\Users\JohnDeHart\...` paths from config and use `%APPDATA%/...` instead.
- **Jupyter Python deps failing on Windows long paths** → trim `jupyter-server` Python requirements to avoid pulling the full `jupyter` meta-package/JupyterLab assets.
- **Spreadsheet formulas warning (`pycel not available`)** → install `pycel` and stop logging normal startup warnings to stderr.
- **Jupyter execute cell failing (“No Jupyter server available”)** → fix MCP protocol/tool discovery so `execute_cell` is discovered reliably; add fail-soft startup/retry behavior for `jupyter-server`.

---

## Prerequisites

- Windows 10/11
- Git
- Node.js **LTS** (includes npm)
- Python 3.x (we used Microsoft Store Python 3.13 successfully, but other installs work)

---

## Step-by-step install on a fresh Windows machine

### 1) Install Node.js (includes npm)

Recommended (winget):

```powershell
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
```

Close and reopen PowerShell (PATH refresh), then verify:

```powershell
node --version
npm --version
```

### 2) Install JS dependencies + start dev

From repo root:

```powershell
npm install
npm run dev
```

If you want a guaranteed clean dev workspace before starting (recommended when handing this to someone new):

```powershell
npm run dev:clean
```

### 3) If Electron fails to install correctly

Symptom during `npm run dev`:

- `Error: Electron failed to install correctly, please delete node_modules/electron and try installing again`

Fix (repo script added):

```powershell
.\scripts\FixElectron.ps1
npm run dev
```

Notes:
- This script downloads the exact Electron runtime zip matching the installed `electron` npm package and extracts it under `node_modules/electron/dist`.

### 4) Install Python dependencies for MCP servers

#### 4.1 Jupyter server (safe requirements for Windows)

From repo root:

```powershell
python -m pip install --upgrade pip --user
python -m pip install -r mcp-servers\jupyter-server\requirements.txt --user --upgrade
```

#### 4.2 Spreadsheet server (full formula engine)

From repo root:

```powershell
python -m pip install -r mcp-servers\spreadsheet-server\requirements.txt --user --upgrade
```

---

## Configuration: make it user-portable (IMPORTANT)

The app data directory must be writable and must not be hardcoded to a specific username.

We changed these files to use `%APPDATA%/...`:

- `config/app.yaml`
- `config/app.dev.yaml`
- `config/app.org.yaml`
- `config/app.smoke.yaml`

Data directory conventions:

- `config/app.yaml` → **main** workspace (`%APPDATA%/insightLM-LT`)
- `config/app.dev.yaml` → **dev** workspace (`%APPDATA%/insightLM-LT-dev`)
- `config/app.smoke.yaml` → **automation/smoke** workspace (`%APPDATA%/insightLM-LT-smoke`)
- `config/app.org.yaml` → **demo source** workspace (`%APPDATA%/insightLM-LT-org`)

Example:

```yaml
dataDir: "%APPDATA%/insightLM-LT-dev"
```

This resolves to:

- `C:\Users\<yourUser>\AppData\Roaming\insightLM-LT-dev\...`

---

## Jupyter notebook execution: what was broken and what we changed

### Symptom

When running a notebook cell:

- `No Jupyter server available. Please ensure jupyter-server MCP server is enabled.`

Sometimes Electron dev process would exit/crash after this.

### Root cause

`mcp-servers/jupyter-server/server.py` was printing an **unsolicited JSON-RPC init message** with `id: 1` on startup.
Electron’s MCP client also starts queued requests at `id: 1`, so the init message could be mistakenly consumed as the response to the first request (e.g. `tools/list`), which breaks tool discovery and prevents `execute_cell` from registering.

### Fixes applied

- `mcp-servers/jupyter-server/server.py`
  - Removed the unsolicited startup JSON “init response”.
  - Initialization is handled only in response to the real `"initialize"` request.

- `electron/services/mcpService.ts`
  - Hardened parsing so “init-like” messages are treated as unsolicited and **never matched** to queued request IDs (prevents collisions).

- `electron/main.ts`
  - `mcp:jupyter:executeCell` handler now:
    - falls back to the canonical server name `jupyter-server` if tool discovery is delayed
    - attempts to start `jupyter-server` if not running
    - retries briefly during startup
    - passes `notebook_path` as `workbook://<workbookId>/...` so the python server resolves safely under `INSIGHTLM_DATA_DIR`.

---

## Python: Windows long-path install failure (Jupyter)

### Symptom

pip install error similar to:

- `OSError: [Errno 2] No such file or directory: ... jupyterlab-manager ...`
- hint about enabling Windows Long Paths

### Fix applied

We trimmed `mcp-servers/jupyter-server/requirements.txt` to avoid pulling the heavy `jupyter` meta-package and JupyterLab extension assets.
The server imports only:

- `jupyter_client`
- `nbformat`
- `ipykernel`
- `jupyter-mcp-server`

---

## Log noise: “ERROR” lines that weren’t errors

Some MCP servers printed normal startup messages to **stderr**, and the Electron MCP wrapper tags stderr output as:

- `[MCP <server> ERROR] ...`

We changed these to print to stdout instead:

- `mcp-servers/spreadsheet-server/server.py` (pycel fallback message)
- `mcp-servers/workbook-dashboard/server.py` and `server_v2.py` (“Dashboard Prompt Manager starting...”)

---

## Verification checklist (recommended)

### App starts

From repo root:

```powershell
npm run dev
```

Confirm Electron opens and the Window loads.

### Smoke test (isolated workspace; does not pollute dev)

```powershell
npm run smoke:run
```

### Jupyter server integration test (CLI)

From repo root:

```powershell
node tests/test-jupyter-server-workbook-url-path.mjs
```

Expected output includes:

- `✅ notebook created at expected workbooks/<id>/... location`

---

## Repo files changed (for cherry-pick / review)

### New

- `scripts/FixElectron.ps1`
- `docs/INSTALL_NOTES_WINDOWS.md`

### Updated

- `docs/SETUP_GUIDE.md`
- `config/app.yaml`
- `config/app.dev.yaml`
- `config/app.org.yaml`
- `config/app.smoke.yaml`
- `mcp-servers/jupyter-server/requirements.txt`
- `mcp-servers/jupyter-server/server.py`
- `mcp-servers/spreadsheet-server/server.py`
- `mcp-servers/workbook-dashboard/server.py`
- `mcp-servers/workbook-dashboard/server_v2.py`
- `electron/services/mcpService.ts`
- `electron/main.ts`
- `tests/test-jupyter-server-workbook-url-path.mjs`



