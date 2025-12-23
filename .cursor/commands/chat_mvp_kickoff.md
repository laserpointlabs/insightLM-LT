You are starting **Chat MVP** work in `insightLM-LT`.

## Objective

Ship a deterministic, automation-safe chat experience (core message send/receive + minimal UX affordances), with smoke coverage.

## First target (recommended)

Implement the “no workbooks scoped” hint in Chat UI:
- visible when scoping = “All workbooks” vs “Context only” is unclear OR when there are 0 scoped workbooks
- links/jumps to Contexts view
- has stable `data-testid`
- add smoke assertion in `tests/automation-smoke-ui.mjs`

## Non-goals (for now)

- agent frameworks
- long-term memory/teams
- deep chat history UX (unless minimal + deterministic)

## Required validation

- `npm run test:automation:prod`
- `npm run test:decoupling`
