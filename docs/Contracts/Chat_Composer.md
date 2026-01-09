### Reference Map — **Chat Composer (Continue/Cursor parity)** *(implemented + smoke-covered)*

#### Upstream reference
- **Continue**: “press enter to send” (chat input behavior) — [`continuedev/continue/docs/chat/how-to-use-it.mdx`](https://github.com/continuedev/continue/blob/main/docs/chat/how-to-use-it.mdx)
- **VS Code** (baseline for chat input affordances): updated chat input area + `@`/`/` discovery — VS Code release notes [`v1_94.md`](https://github.com/microsoft/vscode-docs/blob/main/release-notes/v1_94.md)

> Note: Continue’s public docs don’t spell out autosize/textarea internals; we’ll implement the standard Continue/Cursor behavior and lock it down with smoke tests.

#### Must‑match behaviors (checklist)
- [x] **Send/newline**: **Enter = send**, **Shift+Enter = newline** (Continue/Cursor-style).
- [x] **Autosize**: input grows with content up to a max height; after that it becomes internally scrollable (no overlap).
- [x] **Wrapping**: normal word-wrap; long tokens do not create horizontal overflow.
- [x] **Mentions**: typing `@` opens a menu anchored to the composer; selecting an item inserts cleanly **without caret jumping** or text shifting.
- [x] **Chips/refs**: referenced items render as stable chips (no inline overlay hacks inside the textarea).
- [x] **IME-safe**: don’t send while the user is composing text (composition events).
- [x] **Deterministic UX**: clear disabled states; explicit empty/error states remain.

#### Current repo status (checklist)
- [x] **Implemented**:
  - [x] Enter/Shift+Enter semantics + IME-safe “don’t send while composing” guard.
  - [x] Autosize textarea with `maxRows` + internal scroll after max height.
  - [x] Mention menu rendered in a portal with flip-up logic near bottom panes; selection does not cause caret jumps.
  - [x] Cursor/Continue-style **ref chip row** (no inline overlay hacks inside the textarea).
  - [x] Draft persistence across tab switches via a persisted draft store.
- [x] **Automation proof** (`tests/automation-smoke-ui.mjs`):
  - [x] Pop Chat out → type draft → switch tabs → verify draft persists.
  - [x] `@` mention → select → verify **chip** exists (not raw `workbook://...` text in textarea).
  - [x] Send message → verify user message appears.

#### Explicit non‑goals (for this pass)
- Edit & rerun / history branching (that’s separate work).
- Tabs/layout docking/splits (separate “VS Code editor groups” item).
- Switching spreadsheet engines (Luckysheet/Univer) not part of composer work.

#### Repo touch points (what will change)
- `src/components/Sidebar/Chat.tsx` (composer behavior + chips rendering approach)
- `src/components/MentionTextInput.tsx` (autosize + key handling + mention insertion stability)
- `src/testing/testIds.ts` (add any missing testIds; no inline strings)
- `tests/automation-smoke-ui.mjs` (add a deterministic composer smoke step)

#### Implementation map (where to look)
- **Composer input (textarea)**: `src/components/MentionTextInput.tsx`
  - `enterBehavior="send"` implements Enter=send / Shift+Enter=newline
  - Autosize logic: `autosize` + `maxRows`
  - Mention menu: portal + flip-up positioning + caret-safe insertion
- **Chat wiring + chip row + draft persistence**: `src/components/Sidebar/Chat.tsx`
  - Draft persistence keys: `chatKey` + `activeContextId` (or `noctx`)
  - Ref chips container: `data-testid="chat-refs"`
- **Test IDs**: `src/testing/testIds.ts`
  - Chat: `testIds.chat.*` (`chat-input`, `chat-send`, `chat-mention-menu`, `chat-refs`, etc.)
- **Smoke**: `tests/automation-smoke-ui.mjs`
  - Chat composer assertions live in the “Pop Chat out into a tab…” block

#### Proof (deterministic smoke)
- [x] Insert `@` mention → verify chip present.
- [x] Draft persistence across tab switches.
- [x] Send message → verify it renders.
- [x] Multi-line typing → assert textarea **height grows** up to `maxRows`, then becomes internally scrollable.
- [x] Keyboard: assert **Shift+Enter inserts newline** (and Enter sends).
- [x] Wrapping: type a long token (no spaces) → assert **no horizontal overflow** (assert `scrollWidth <= clientWidth`).

#### Decisions (record)
- **Keyboard**: Enter=send, Shift+Enter=newline ✅
- **Chip UX**: chip row (not inline overlay) ✅

#### Known follow-ups (separate work; keep this contract “done”)
- [x] **UI copy parity**: update Chat send button tooltip to match Enter=send / Shift+Enter=newline. (`src/components/Sidebar/Chat.tsx`)