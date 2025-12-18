You are debugging flaky UI automation in `insightLM-LT` (CDP smoke).

## Goal

Make `npm run test:automation:prod` deterministic.

## Checklist (in order)

1. **Ensure only one Electron instance is running**
   - CDP port must be free: `127.0.0.1:9222`
2. **Enable automation mode**
   - Smoke should call: `window.__insightlmAutomationUI.setMode(true)`
3. **Replace fixed sleeps with polling**
   - Use `waitForSelector` / `waitForGone`
4. **Stop using text clicks**
   - Add missing `data-testid` selectors; click by selector only
5. **Fix dynamic ID selection**
   - Prefer set-diff and parsing IDs from `data-testid`
6. **Make empty-states explicit**
   - If a graph/table can be empty, render a visible placeholder and a stable DOM attribute
7. **Reduce LLM dependence**
   - Use deterministic fixtures (e.g., write a CSV with `window.electronAPI.file.write`)
   - Assert structure (`data-result-type`, `data-graph-points`) not text

## Where to look

- Prod runner: `tests/run-prod-renderer-smoke.mjs`
- CDP smoke: `tests/automation-smoke-ui.mjs`
- Test IDs: `src/testing/testIds.ts`
- CDP enablement: `electron/main.ts`
