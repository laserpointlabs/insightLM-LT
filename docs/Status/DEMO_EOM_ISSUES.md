## Demo EOM Issues Log (Deloitte) — tracking

Use this file to capture **demo rehearsal issues** that must be fixed before the Deloitte end-of-month demos.

Scope:
- Demo #1 (Vendor Program Workflow)
- Demo #2 (Trade Study)
- Demo #3 (Conceptualizer)
- Any “demo-critical” cross-cutting UX issues (loading, scoping, thinking/progress, stability)

Rules of thumb:
- If it can break confidence in a live demo, log it here.
- Prefer **repro steps + stable selectors** over vague descriptions.
- If a bug is truly non-demo-critical, keep it in `todo.md` instead of this file.

---

### How to file an issue (copy/paste template)

```text
ID: DEMO-###
Demo: 1 | 2 | 3 | Cross-cutting
Severity: Blocker | High | Medium | Low
Area: Chat | Workbooks | Sheets | Notebook | Dashboards | Contexts/Scoping | Demos menu | Other

Summary:

Repro steps:
1)
2)
3)

Expected:

Actual:

Evidence:
- Screenshot/video:
- Console logs (if relevant):
- File(s)/workbook(s) involved:
- TestId(s) involved:

Notes / hypothesis:

Proposed fix:

Owner:
Status: Open | In progress | Fixed | Won't fix
Fix PR/commit:
Smoke proof:
- (add/extend `tests/automation-smoke-ui.mjs` step if demo-critical)
```

---

### Open issues

#### DEMO-001 — (placeholder)
- **Demo**:
- **Severity**:
- **Summary**:

#### DEMO-002 — Luckysheet uncaught exception on renderer reload after opening a sheet
- **Demo**: Cross-cutting (Sheets)
- **Severity**: High
- **Area**: Sheets / Renderer reload
- **Summary**: After opening a Luckysheet-backed `.is` sheet, a later renderer reload can emit an uncaught exception: `TypeError: Cannot read properties of undefined (reading 'getContext')` from `luckysheet.umd.js`.
- **Repro steps**:
  1) Open any `.is` sheet (e.g., `workbook://uav-trade-study/documents/trade/decision_matrix.is`)
  2) Trigger a renderer reload (e.g., via automation smoke “Split layout persists after renderer reload”, or user menu if available)
  3) Observe uncaught exception in console
- **Expected**: No uncaught exceptions; reload remains stable.
- **Actual**: Uncaught exception surfaced from Luckysheet bundle.
- **Evidence**:
  - Console: `TypeError: Cannot read properties of undefined (reading 'getContext')` at `https://cdn.jsdelivr.net/npm/luckysheet@2.1.13/dist/luckysheet.umd.js:9:825245`
  - Seen during `npm run test:automation:smoke` after passing most steps.
- **Notes / hypothesis**:
  - Likely a teardown/init ordering issue during reload where Luckysheet references a canvas before it exists.
  - Could potentially be mitigated by ensuring the sheet view unmounts/cleans up safely before reload, or by guarding init when container has 0 size.
- **Proposed fix**:
  - Hardening in `src/extensions/spreadsheet/SpreadsheetViewer.tsx` around init/cleanup and container readiness (fail-soft; no blank white screen).
  - Add a deterministic regression smoke step focused on “open sheet → reload → no uncaught exceptions”.
  - Consider vendoring Luckysheet locally (avoid CDN) if bundle timing contributes.
- **Status**: Open
