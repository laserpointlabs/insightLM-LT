# Packaged UI Smoke (Manual) — How to Run

This repo includes a **manual-only** GitHub Actions workflow that:

- builds the app (`npm run build`)
- packages it in **unpacked** mode (`electron-builder --dir`)
- launches the packaged exe
- runs the selector-only UI smoke (`npm run test:automation:smoke`) via CDP

The workflow file is: `.github/workflows/packaged-smoke.yml`

## When to use it

- Before cutting a release / building an installer
- After large UI refactors (Workbooks/Contexts/Chat)
- When you want “packaged app” confidence without running it on every push

## How to run it (GitHub UI)

1. Go to your repo on GitHub
2. Click **Actions**
3. In the left sidebar, select **Packaged UI Smoke (manual)**
4. Click **Run workflow**
5. (Optional) adjust inputs:
   - `cdpHost`: default `127.0.0.1`
   - `cdpPort`: default `9222`
   - `cdpWaitSeconds`: default `45`
6. Click **Run workflow** (confirm)

## What it does (high level)

- Packages to `out/win-unpacked/insightLM-LT.exe`
- Starts the exe and waits for `cdpHost:cdpPort` to accept TCP connections
- Runs `npm run test:automation:smoke`
- Stops the exe even on failure (cleanup)

## Common failures / fixes

- **CDP never comes up**
  - Ensure Electron sets the debug port (this repo does it in `electron/main.ts`)
  - Increase `cdpWaitSeconds` (slow runners)
  - If you ever change the port, update the workflow default + smoke env vars

- **Smoke fails on a selector**
  - Update selectors in `src/testing/testIds.ts`
  - Update docs in `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md`
  - Re-run the workflow to confirm the fix in a packaged build

## Running the same smoke locally

With the app running (dev or packaged) and CDP enabled:

- `npm run test:automation:smoke`

### Local option (no admin / no Developer Mode): "prod renderer" smoke

If you *can't* run `electron-builder` locally (Windows symlink privilege), you can still validate the **production renderer** (built `dist/`) by running:

- `npm run test:automation:prod`

This:
- runs `npm run build`
- launches Electron with `INSIGHTLM_FORCE_PROD_UI=1` so it loads `dist/index.html` (no Vite)
- waits for CDP `9222`
- runs the same selector-only smoke test

### Local packaging note (Windows)

If you try to run `electron-builder --dir` locally on Windows, you may hit:

- `ERROR: Cannot create symbolic link : A required privilege is not held by the client`

Fix by enabling **Windows Developer Mode** (Settings → *For developers* → Developer Mode), or running your terminal **as Administrator**, then re-run packaging.
