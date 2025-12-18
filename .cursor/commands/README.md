## Cursor Commands (Project Guardrails)

This folder contains **Cursor slash-commands** used to keep development in `insightLM-LT` deterministic, testable, and automation-centric.

### How to use

- In Cursor, invoke a command by typing `/` and selecting the command (commands are sourced from the `.cursor/commands/` directory).
- Each `.md` file is a command prompt that Cursor inserts into the current AI thread.

### Related: Cursor Rules

We also maintain **Cursor Rules** (auto-applied guidance) in:
- `.cursor/rules/`

See:
- `docs/Automation/AUTOMATION_SMOKE_TESTING.md`

### Commands we maintain

- **`automation_smoke.md`**: Enforces automation-centric development and required validation via `npm run test:automation:prod`.
- **`automation_add_coverage.md`**: Step-by-step instructions to add `data-testid`s + extend the CDP smoke.
- **`debug_flaky_automation.md`**: Playbook for stabilizing flaky UI automation (polling, set-diff ids, deterministic fixtures).
- **`feature_dod.md`**: MVP “Definition of Done” checklist (selectors, deterministic UX, automation, decoupling).
- **`mcp_decoupling_guardrails.md`**: Guardrails and required checks when touching MCP/tool discovery/routing.
- **`chat_mvp_kickoff.md`**: Chat MVP starting target + required validations.
- **`release_merge_checklist.md`**: Pre-merge checklist for keeping `main` clean.

### Adding a new command

- **File name**: short and verb-y (e.g. `add_testids.md`, `debug_ci.md`)
- **Content**:
  - Start with a 1–2 line statement of intent (“You are doing X…”)
  - Include non-negotiable rules (if any)
  - Include “read these files/docs first” pointers
  - Include the exact commands to run when relevant
- **Keep it deterministic**: avoid instructions that depend on external services unless the command explicitly sets them up.

### Editing/removing commands

- Cursor config files may be protected from deletion in this environment.
- If a command is obsolete, mark it as **deprecated** and point to the replacement instead of deleting it.
