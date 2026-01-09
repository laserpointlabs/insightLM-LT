### Reference Map — **Chat Response UX (Continue/Cursor parity)** *(contract; no code changes yet)*

#### Upstream reference (authoritative)
- **Continue (GUI) — commit `b426b196c90d651dd2e56a464428d72155c6d8ff`**
  - **Chat page / message timeline**: `gui/src/pages/gui/Chat.tsx`
    - Uses a dedicated `thinking` role rendered via a collapsible peek (`ThinkingBlockPeek`)
  - **Animated “Thinking…”**: `gui/src/components/StepContainer/ThinkingIndicator.tsx`
  - **Collapsible thinking details (“Thought for 1.2s…”)**: `gui/src/components/mainInput/belowMainInput/ThinkingBlockPeek.tsx`

#### Problem statement (current repo gaps)
- Users can’t tell if the app is “thinking” (no animation / weak affordances).
- “Thinking/Activity” UI is rough: duplicate controls, collapse doesn’t actually collapse, and the user can’t manage verbosity.
- The response area doesn’t give a best-practice “what’s happening” view (tool/activity trace should be collapsible, readable, and stable).

#### Must‑match behaviors (checklist — what we will copy)
- [ ] **Single, clear “thinking” indicator** while waiting (no duplicate “thinking” buttons).
- [ ] **Animated affordance** during thinking (ellipsis/pulse) and **aria-live** semantics (non-intrusive).
- [ ] **Collapsible “thinking details”** (peek/expand) with a compact header (Continue-style “Thinking…” / “Thought for 1.2s”).
- [ ] **Collapsible tool/activity trace**:
  - [ ] Default: **collapsed** (summary only)
  - [ ] Expand: shows steps with status (running/ok/error) and optional details
  - [ ] Expand/collapse actually changes layout (not just label text)
- [ ] **Streaming response UX**:
  - [ ] Show placeholder assistant bubble immediately
  - [ ] Stream updates visibly (typewriter/stream) without jank
  - [ ] When done, replace streaming placeholder with final assistant message
- [ ] **No visual duplication**: at most one “thinking” affordance and one “activity” toggle for the active response region.
- [ ] **Deterministic empty/error states** remain explicit and stable.

#### Explicit non‑goals (separate contracts)
- Edit & rerun / history branching (`docs/Contracts/Chat_Edit_Rerun.md`)
- Tabs/layout docking/splits (`docs/Contracts/Workbench_Tabs_Docking_Splits.md`)
- Changing providers/backends or implementing true token streaming (UX is independent of provider)

#### Repo touch points (planned)
- `src/components/Sidebar/Chat.tsx` (response rendering: thinking/streaming/activity blocks)
- `src/components/Sidebar/ChatMessage.tsx` (assistant message rendering affordances)
- `src/testing/testIds.ts` (add stable ids for response UX: thinking toggle, activity toggle, streaming bubble)
- `tests/automation-smoke-ui.mjs` (deterministic smoke for response UX)

#### Proof (deterministic smoke)
- [ ] **Thinking indicator appears** when send begins (and there is exactly one).
- [ ] **Activity collapses/expands** deterministically (assert collapsed state reduces visible step rows).
- [ ] **Streaming bubble** appears then final assistant message persists.
- [ ] **No duplicate controls**: assert one `[data-testid="chat-thinking-toggle"]` (or equivalent) and one activity toggle in the active response region.
