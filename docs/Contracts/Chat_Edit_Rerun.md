### Reference Map — **Chat Edit & Rerun / History Branching (Continue/Cursor parity)** *(contract; no code changes yet)*

#### Upstream reference (authoritative)
- **Continue (GUI) — commit `b426b196c90d651dd2e56a464428d72155c6d8ff`**
  - **Chat page**: `gui/src/pages/gui/Chat.tsx`
    - Uses structured history items + editor-state inputs
    - References edit mode + streaming edit thunk (`streamEditThunk`)
  - **Edit thunk**: `gui/src/redux/thunks/edit` (imported by `Chat.tsx`)

#### Must‑match behaviors (checklist — what we will copy)
- [ ] **Edit a previous user message** from history.
- [ ] **Rerun** from that edited message.
- [ ] **Branching**: rerun produces a new branch/thread from that point (does not overwrite original history).
- [ ] **Branch navigation**: user can switch between branches (original vs rerun) deterministically.
- [ ] **Context integrity**: rerun uses the same context scope + refs/chips the user had at that point (unless explicitly changed).
- [ ] **Safety/clarity**: show “You are viewing a branched history” indicator when not on the main line.

#### Explicit non‑goals (for this pass)
- Cross-project history portability
- “Git-style” merge/rebase of conversations

#### Repo touch points (planned)
- `src/components/Sidebar/Chat.tsx` (history UI, edit affordance, rerun action)
- `src/store/*` (if needed: persist branch trees per chatKey + contextId)
- `src/testing/testIds.ts` (stable ids for edit/rerun controls)
- `tests/automation-smoke-ui.mjs` (deterministic smoke for edit+rerrun)

#### Proof (deterministic smoke)
- [ ] Send message A → assistant replies.
- [ ] Edit message A → rerun.
- [ ] Assert **two branches** exist and original branch remains unchanged.
- [ ] Switch branches → assert the visible transcript changes deterministically.
