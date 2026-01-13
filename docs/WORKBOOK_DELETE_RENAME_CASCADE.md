### Workbook delete/rename across multiple Contexts (design notes)

This document captures **best‑practice patterns** and a recommended policy for what should happen when a **Workbook** is **deleted** or **renamed** while it is referenced by **many Contexts** (and therefore many chat threads).

It is intentionally **not a contract**. It’s a design note to align expectations before implementing the cascade.

---

## Problem statement

In InsightLM‑LT, a Workbook can be referenced by multiple Contexts.

- A user can activate different Contexts that include the same Workbook.
- Each Context can have an associated chat thread (disk‑backed) and possibly other derived state (RAG cache, UI selections).

If we “just delete the workbook,” we risk:
- stale workbook references in Context definitions (`workbook_ids`)
- stale “quick workbook context” (`[WB] <name>`) entries
- an active context that points at a now-invalid workbook set
- confusing chat history (threads exist, but their underlying sources were removed)

This is the classic “delete a referenced entity” problem from database design: you need a policy equivalent to **RESTRICT / CASCADE / SET NULL / SOFT DELETE**.

---

## Data model recap (today)

- **Workbook**: identified by `workbookId` (stable). Has a display `name` (mutable).
- **Context** (`context-manager`): JSON file with:
  - `id`, `name`
  - `workbook_ids: string[]`
  - optional `folders`
- **Active context pointer**: `contexts/active.json` (`context_id`)
- **Chat thread**: disk-backed per context session id (today: `context-<contextId>.json` in `chats/`).

Important: Context membership should be **by ID**, not by workbook name. Rename must not break membership.

---

## Policy choices (common patterns)

### Option A — RESTRICT delete (safest)
Do not allow deleting a workbook while referenced.

- Pros: prevents accidental corruption; easiest to reason about.
- Cons: can block legitimate cleanup; needs “show me what references it” UX.

### Option B — CASCADE detach (safe default for desktop apps)
Allow delete, but **automatically remove the workbook from all contexts**.

- Contexts with other workbooks remain.
- Contexts that become empty must be handled (see below).
- Pros: user intent (“remove workbook”) succeeds; prevents stale refs.
- Cons: can change many contexts silently unless we show impact.

### Option C — CASCADE delete contexts (aggressive)
Allow delete and also delete any context that references it (or any context that becomes empty).

- Pros: “no dangling contexts” guarantee.
- Cons: can destroy user organization and chat history unexpectedly.

### Option D — SOFT DELETE / TRASH (best UX, more work)
Instead of deleting, move to a “Trash/Archived” state and hide from normal lists.

- Pros: undo/recovery; reduces anxiety; avoids breaking historical threads immediately.
- Cons: requires trash UI + restore semantics; larger feature.

**Recommendation for InsightLM‑LT MVP**: Option B (CASCADE detach) + a “safe guardrail” confirmation listing impact.

---

## Recommended behavior (InsightLM‑LT)

### 1) Workbook rename
Rename should be “cheap”:

- Context membership **stays correct** (IDs stable).
- Any **single‑workbook quick context** name should update:
  - `[WB] <old>` → `[WB] <new>`
- Chat context picker should show the new workbook name (it already reads `workbook.getAll()`).

### 2) Workbook delete (CASCADE detach + deterministic outcomes)
When deleting workbook `W`:

1. **Remove W from every Context** that contains it.
2. **Quick contexts** (single-workbook `[WB] …` that target only W) should be **deleted**, not left as empty shells.
3. If a Context becomes **empty** after removing W:
   - Default: **keep the context but mark invalid/empty** is confusing.
   - Recommended: **delete the context** *only if it was auto-generated* (quick context).
   - For user-created contexts: either
     - **auto-delete** (aggressive), or
     - **keep but require user action** (needs UI states).

**Suggested MVP rule**:
- If context was a `[WB]` quick context → delete it.
- If context was user-created:
  - Remove W from `workbook_ids`.
  - If it becomes empty → clear active context if it was active, and keep the context (but it will show “0 workbooks”).
  - (Later improvement: prompt to delete empty contexts or auto-archive them.)

4. **Active context pointer**:
   - If the active context was deleted → clear active context (`active.json: context_id=null`).
   - If active context still exists but is now empty → clear it (so Chat scoped-mode shows deterministic “no context scoped” empty-state).

5. **Chat threads**:
   - Threads are keyed by context id; they should remain **readable** even if sources are gone.
   - If a context is deleted, we have a choice:
     - keep the chat file (orphaned history), or
     - delete it (hard purge).

**Suggested MVP rule**:
- If we delete a quick context as part of cascade, also delete its chat thread file (keeps disk clean).
- If we only remove a workbook from a user-created context, do not touch its chat thread.

6. **UI refresh**:
   - After cascade completes, emit/broadcast `workbooks:changed` and `context:changed` so Chat/Contexts refresh immediately.

---

## Implementation sketch (where to put the cascade)

Centralize the cascade in **Electron main** so it applies regardless of which UI initiated it:

- `electron/ipc/workbooks.ts`
  - `workbook:delete`:
    - call `workbookService.deleteWorkbook(id)`
    - then call `mcpService.sendRequest(\"context-manager\", \"tools/call\", …)` to:
      - `list_contexts`
      - `get_active_context`
      - `update_context` / `delete_context` for affected contexts
      - `activate_context` or clear active context (via a new context-manager tool if needed)
    - then broadcast `insightlm:workbooks:changed` and `insightlm:context:changed` (or reuse existing fan-out)
  - `workbook:rename`:
    - rename via `workbookService.renameWorkbook(id, newName)`
    - then update any `[WB]` context names that reference that workbook id (list_contexts + update_context)

Because `context-manager` is file-based and runs under `INSIGHTLM_DATA_DIR`, it’s the authoritative place for contexts; Electron should orchestrate.

---

## Testing strategy (deterministic)

Add smoke coverage (CDP) for:
- Create workbook W
- Create two contexts C1 and C2 that include W (plus other workbooks)
- Create a quick `[WB]` context for W (via chat picker)
- Delete workbook W
- Assert:
  - W is not in Workbooks list and not in Chat context picker
  - quick context is gone
  - C1/C2 no longer include W
  - active context is cleared iff it became invalid/empty

---

## Open questions (for later UX polish)

- Should we present a “References” dialog on delete showing:
  - number of contexts affected
  - which contexts will lose the workbook
  - whether any contexts will become empty
  - whether quick contexts will be deleted
- Should workbook delete be “Trash” instead of “Delete”?
- Should user-created contexts with 0 workbooks be auto-archived or auto-deleted?

