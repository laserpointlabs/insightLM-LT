## Automation Smoke Testing (UI) — How we test like a user, deterministically

This repo is intentionally **automation-centric**: every MVP feature should be shippable with **repeatable, selector-only UI smoke coverage**.

Why this matters:
- **Fast confidence**: smoke tests catch broken UX flows early (not just API correctness).
- **Deterministic**: we avoid “it works on my machine” and LLM flakiness.
- **Scalable**: stable selectors (`data-testid`) let anyone add coverage without brittle text/CSS matching.

---

### What `npm run test:automation:prod` does (low-level)

`npm run test:automation:prod` runs a *local production-renderer smoke* without packaging:

- Builds the app (`npm run build`)
- Launches Electron loading the built renderer (`dist/`) via `INSIGHTLM_FORCE_PROD_UI=1`
- Waits for Chrome DevTools Protocol (CDP) to be available on `127.0.0.1:9222`
- Runs the **selector-only** smoke test: `npm run test:automation:smoke`

The runner code is `tests/run-prod-renderer-smoke.mjs`. The UI smoke test is `tests/automation-smoke-ui.mjs`.

**Note**: this is the low-level runner. For day-to-day usage, prefer `npm run smoke:run`.

---

### How the UI smoke test works (CDP, not screenshots)

The smoke test uses **Chrome DevTools Protocol** to drive the running Electron renderer:
- Connect to CDP target (`/json/list`)
- Use `Runtime.evaluate` to execute small DOM scripts:
  - query selectors
  - click buttons
  - fill inputs (using the native value setter so React sees the change)
  - poll/wait for elements to exist/disappear

Why CDP:
- No brittle OCR/screenshot comparisons
- No reliance on browser automation frameworks (Playwright/Selenium) for this MVP
- Electron already exposes CDP in dev/unpackaged mode (see `electron/main.ts`)

---

### The golden rule: **selector-only** via stable `data-testid`

Smoke tests should **never** rely on:
- visible text labels (copy changes break tests)
- CSS classes (Tailwind refactors break tests)
- DOM structure assumptions (layout refactors break tests)

Instead we standardize:
- `data-testid` for every automation-relevant control
- centralized IDs in `src/testing/testIds.ts`

Selector reference doc: `docs/Automation/ELECTRON_MCP_UI_AUTOMATION.md`.

---

### “Automation Mode” (force-show hover controls)

Some controls are intentionally hover-only for a clean UX. Automation needs them visible.

The smoke test forces automation mode on boot:
- `window.__insightlmAutomationUI.setMode(true)`

This ensures icon-only action strips are always present/clickable without mouse hover.

---

### Making tests deterministic (avoid LLM flake)

UI smoke is about **core UX flows**, not LLM creativity. When we must touch LLM-driven areas, we design the flow so assertions remain deterministic.

Patterns we use:
- **Prefer deterministic fixtures** over prompting the LLM for structure.
  - Example: for dashboard graph assertions, the smoke test writes a known CSV into a workbook using `window.electronAPI.file.write(...)` and then asks a graph question referencing `workbook://.../project_budget_2025.csv`.
- **Assert UI invariants** rather than exact content.
  - Example: assert `data-result-type="graph"` and `data-graph-points > 1`, not the exact labels.
- **Explicit empty-states** are required.
  - If the system can’t produce a visualization, it should render a clear empty state (not an invisible/zero-size chart). This is both better UX and easier to assert.

---

### Handling dynamic IDs reliably (the “set-diff” pattern)

Many UI entities are created at runtime (workbooks, dashboards, tiles) and have IDs you can’t hardcode.

Preferred patterns:
- **Parse the ID from `data-testid`** after locating the element.
  - Example: find `[data-testid^="workbooks-item-"]` that contains the workbook name, then extract the id from the testid.
- **Set-diff for “new item created”**
  - Capture a list of existing IDs before an action.
  - Trigger creation.
  - Capture IDs after.
  - The new ID is the set difference.

This avoids flaky “find by title substring” logic and makes the test resilient to ordering changes.

---

### How to add automation coverage for new development

When adding a new feature, the expected workflow is:

- **Add stable selectors**
  - Add a new entry in `src/testing/testIds.ts`.
  - Wire it into the component via `data-testid={testIds...}`.
- **Add a minimal smoke step**
  - Extend `tests/automation-smoke-ui.mjs` with the smallest end-to-end interaction that proves the feature is usable.
  - Prefer building on existing flow state (re-use created workbook/dashboard when possible).
- **Add a deterministic assertion**
  - Assert presence of an element, a `data-*` attribute, or a modal state.
  - Avoid asserting exact prose strings from the LLM.

If the new feature *cannot* be asserted deterministically yet, that is usually a **product/UX bug** (missing empty state, missing test id, or missing state surfaced to DOM).

---

### What to avoid (common sources of flaky tests)

- **Fixed sleeps** instead of polling for state changes (use `waitForSelector` / `waitForGone`)
- **Text-based clicking** (use `data-testid`)
- **Assuming list ordering** (use set-diff or id parsing)
- **Asserting exact LLM response text** (assert structural invariants instead)
- **Relying on hover state** (enable automation mode)

---

### Where to look in code

- **Prod runner**: `tests/run-prod-renderer-smoke.mjs`
- **CDP smoke**: `tests/automation-smoke-ui.mjs`
- **Central test IDs**: `src/testing/testIds.ts`
- **Electron CDP enablement**: `electron/main.ts` (remote debugging port `9222` in dev/unpackaged)

---

### Recommended “Definition of Done” for MVP features

- Feature is usable manually
- Feature has stable `data-testid` selectors
- `npm run smoke:run` covers the happy path (and key empty-state if relevant)
- Assertions are deterministic and do not depend on LLM prose

---

### Recommended commands (do not pollute your workspace)

Smoke runs use a dedicated **smoke data directory** (`config/app.smoke.yaml` → `%APPDATA%/insightLM-LT-smoke`) and clean up:

```bash
# Run smoke with automatic pre/post cleanup
npm run smoke:run

# Just clean the smoke workspace (fails loudly if files are locked)
npm run smoke:clean
```

For backwards compatibility, `npm run test:automation:prod` still exists, but `smoke:run` is preferred.

---

### Sharing this with another AI thread (“/command” prompt)

If you want to bootstrap a new AI thread quickly, paste:

- `prompts/automation_smoke.md`
