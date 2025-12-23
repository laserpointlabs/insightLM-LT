### /automation_smoke

You are working in a repo that uses **deterministic, selector-only UI smoke tests** driven by **Chrome DevTools Protocol (CDP)**.

Your job: when implementing new UI/UX, **add automation coverage as part of the feature** and ensure `npm run test:automation:prod` stays green.

#### How this repo’s UI automation works (read first)

1. Read these docs:
   - `docs/Automation/AUTOMATION_SMOKE_TESTING.md` (how/why, anti-flake patterns)
   - `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md` (stable selector catalog)
2. Read these code files:
   - `tests/run-prod-renderer-smoke.mjs` (what `npm run test:automation:prod` does)
   - `tests/automation-smoke-ui.mjs` (CDP test implementation + helper utilities)
   - `src/testing/testIds.ts` (canonical `data-testid` registry)

#### Rules (do not violate)

- **Selector-only**: only click/fill via `data-testid` selectors, not text/CSS/class selectors.
- **No LLM flake**: assertions must be deterministic. Never assert exact LLM prose.
- **No fixed sleeps**: poll with `waitForSelector` / `waitForGone` unless a tiny settle delay is truly required.
- **Dynamic IDs**: use ID parsing from `data-testid` and/or the “set-diff” pattern to identify newly created entities.
- **Empty states must render**: if a feature can return “no data”, the UI must show an explicit empty-state that automation can detect.

#### Implementation workflow (for any new feature)

1. Add stable selectors:
   - Add new IDs to `src/testing/testIds.ts`.
   - Wire them in the UI (`data-testid={...}`).
2. Extend the smoke test:
   - Update `tests/automation-smoke-ui.mjs` to cover the smallest end-to-end happy path proving the feature is usable.
   - Add a deterministic assertion (presence, `data-*` attribute, modal opened/closed, etc.).
3. Validate locally:
   - Run `npm run test:automation:prod` and fix any flake.

#### If you’re in a *different repo / different directory layout*

If these exact paths don’t exist, do the equivalent:
- Find the centralized `data-testid` registry (or create one).
- Find the CDP test runner and smoke script (or create minimal ones).
- Ensure Electron exposes CDP (remote debugging port) in dev/unpackaged mode.

#### Quick “definition of done”

- Feature is manually usable
- Feature has stable `data-testid` selectors
- Smoke covers the happy path (and key empty state if relevant)
- `npm run test:automation:prod` passes deterministically
