You are preparing to merge a feature branch into `main`.

## Checklist

- Confirm branch is up to date with `main`
- Run locally:
  - `npm run test:automation:prod`
  - `npm run test:decoupling`
  - `npm test`
- Squash merge (single commit) with a clear message
- Push `main`, monitor CI, do not delete branch until CI is green
- After CI passes:
  - delete remote branch
  - delete local branch
