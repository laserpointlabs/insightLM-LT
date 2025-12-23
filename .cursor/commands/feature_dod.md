Use this as the **Definition of Done** checklist for any MVP feature in `insightLM-LT`.

## MVP Feature DoD (must pass)

- **UX**: usable end-to-end manually (no dead ends, no invisible states)
- **Deterministic UX**: no `alert/prompt/confirm`; use InputDialog/ConfirmDialog/Toast patterns
- **Stable selectors**: add/update `data-testid` via `src/testing/testIds.ts`
- **Automation coverage**:
  - Add/extend selector-only steps in `tests/automation-smoke-ui.mjs`
  - Assertions are deterministic (no exact LLM prose assertions)
  - Ensure explicit empty-state for “no data”
- **Validation**: run and pass `npm run test:automation:prod`
- **No regressions**: `npm run test:decoupling` still passes (or explain why and fix)

## Quick pointers

- Smoke guide: `docs/Automation/AUTOMATION_SMOKE_TESTING.md`
- Selector catalog: `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md`
