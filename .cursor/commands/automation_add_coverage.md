You are adding UI automation coverage for a new feature in `insightLM-LT`.

## Goal

Add stable selectors + a deterministic UI smoke step so the feature is validated by:
- `npm run test:automation:prod`

## Steps

1. Identify the minimal “user happy path” interaction for this feature (one short flow).
2. Add stable selectors:
   - Update `src/testing/testIds.ts`
   - Add `data-testid={...}` in the UI elements needed for the flow
3. Update the CDP smoke test:
   - Edit `tests/automation-smoke-ui.mjs`
   - Use only `data-testid` selectors
   - Use polling helpers (`waitForSelector`, `waitForGone`)
   - Add deterministic assertions (presence, `data-*` attributes, dialog open/close)
4. Run: `npm run test:automation:prod` and fix flake until it’s stable

## References

- `docs/Automation/AUTOMATION_SMOKE_TESTING.md`
- `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md`
