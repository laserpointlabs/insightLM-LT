# TestIds duplicate key postmortem (fixed)

## Summary
We hit a **silent automation break** caused by a duplicate object key in `src/testing/testIds.ts`.

`testIds` is a plain object literal. When the same key is defined twice, **the latter definition overwrites the former** at runtime (no warning).

In our case, `documentViewer` was defined twice, which caused UI + automation to drift:
- UI code referenced `testIds.documentViewer.*` expecting one set of IDs
- The runtime object exposed a different (overwritten) set of IDs
- Smoke selectors intermittently failed or asserted the wrong elements

This is especially dangerous because:
- TypeScript does not reliably flag duplicate keys in large object literals
- The app still “works” visually, but automation becomes flaky / incorrect

## Root cause
- `src/testing/testIds.ts` contained **two `documentViewer: { ... }` blocks**.
- The second block overwrote the first in the exported object, changing IDs like:
  - `tabs`, `tab(...)`, `tabClose(...)`, `saveBar`, `saveButton`, etc.

## Fix
- Removed the duplicate legacy `documentViewer` block so there is **one authoritative** `testIds.documentViewer`.
- Standardized all selectors to use the stable IDs:
  - `document-viewer-tabs`
  - `document-viewer-tab-*`
  - `document-viewer-tab-close-*`
  - `document-viewer-save-bar`
  - `document-viewer-save-button`
- Added additional IDs needed for the new tab features:
  - `document-viewer-tab-context-menu` + context menu actions
  - `unsaved-close-dialog-*` (Save / Don’t Save / Cancel)

## Prevention (what we should do next)
Recommended follow-ups (not all implemented yet):
- Add a lightweight check in CI to detect duplicate keys in `src/testing/testIds.ts` (regex-based is fine).
- Keep the rule: **new UI automation must add ids here only**, never inline strings.
- When editing `testIds`, prefer small, well-scoped diffs to avoid accidental duplication.

## References
- Fixed in the same branch as the tabs/dirty-close work (`feat/ui-bugs-round1`).

