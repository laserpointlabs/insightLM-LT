You are implementing features in `insightLM-LT`. We are **automation-centric**: every MVP UI change must be validated with deterministic UI smoke coverage.

## Non-negotiable rules

- Use **stable `data-testid` selectors only** for UI automation (no text clicks, no CSS selectors).
- Assertions must be **deterministic** (do not assert exact LLM prose).
- Prefer **polling** (`waitForSelector`/`waitForGone`) over fixed sleeps.
- For dynamic entities (workbooks/dashboards/tiles), use **id parsing** from `data-testid` and/or **set-diff** to discover “newly created” IDs.
- Ensure explicit **empty-states** render for “no data” cases (automation must be able to detect the state).

## Read first (docs + key code)

- `docs/Automation/AUTOMATION_SMOKE_TESTING.md` (how/why + anti-flake patterns)
- `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md` (canonical selectors catalog)
- `tests/run-prod-renderer-smoke.mjs` (what `npm run test:automation:prod` does)
- `tests/automation-smoke-ui.mjs` (CDP smoke implementation)
- `src/testing/testIds.ts` (central registry for selectors)

## Required workflow for new development

1. Add/update `data-testid`s (update `src/testing/testIds.ts` and wire into UI components).
2. Extend `tests/automation-smoke-ui.mjs` with the smallest end-to-end happy path proving the feature is usable.
3. Run and pass: `npm run test:automation:prod`

If you cannot write a deterministic assertion for the feature, treat it as a **product/UX gap** (missing test ids, missing empty state, missing stable DOM attributes).
