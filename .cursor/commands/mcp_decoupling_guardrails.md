You are making changes that touch MCP servers, tool discovery, tool execution, or LLM/tool routing.

## Guardrails (do not skip)

- Avoid hardcoded MCP server names in core logic unless intentionally scoped
- Prefer dynamic tool discovery via the ToolRegistry / provider registry
- Keep failures **fail-soft** in user-facing flows (explicit empty states, structured errors)

## Required checks

- Run and pass:
  - `npm run test:decoupling`
  - `npm run test:decoupling:phase1`
  - `npm run test:decoupling:phase2`
  - `npm run test:decoupling:phase3`
  - `npm run test:decoupling:phase4` (dashboards)

## Where the architecture lives

- Decoupling docs: `docs/Decoupling/DECOUPLING_PHASE*_SUMMARY.md`
- Tool discovery tests: `tests/test-mcp-tool-discovery.mjs`
