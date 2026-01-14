### Reference Map — **Chat Response UX (Continue/Cursor parity)** *(contract; no code changes yet)*

#### Upstream reference (authoritative)
- **Continue (GUI) — commit `b426b196c90d651dd2e56a464428d72155c6d8ff`**
  - **Chat page / message timeline**: `gui/src/pages/gui/Chat.tsx`
    - Uses a dedicated `thinking` role rendered via a collapsible peek (`ThinkingBlockPeek`)
  - **Animated “Thinking…”**: `gui/src/components/StepContainer/ThinkingIndicator.tsx`
  - **Collapsible thinking details (“Thought for 1.2s…”)**: `gui/src/components/mainInput/belowMainInput/ThinkingBlockPeek.tsx`
- **VS Code / Copilot Chat**
  - **“Used References” precedent** (references/sources are a dedicated, readable section): `vscode-docs/release-notes/v1_90.md` (Copilot Chat, “Used References”)

#### Problem statement (current repo gaps)
- Users can’t tell if the app is “thinking” (no animation / weak affordances).
- “Thinking/Activity” UI is rough: duplicate controls, collapse doesn’t actually collapse, and the user can’t manage verbosity.
- The response area doesn’t give a best-practice “what’s happening” view (tool/activity trace should be collapsible, readable, and stable).
- **Sources** are messy:
  - Duplicate “Sources” blocks show up (“double sources”).
  - Links are hard to scan; visual hierarchy is weak compared to Cursor/Continue/Copilot.

#### Must‑match behaviors (checklist — what we will copy)
- [x] **Single, clear “thinking” indicator** while waiting (no duplicate “thinking” buttons).
- [x] **Animated affordance** during thinking (ellipsis/pulse) and **aria-live** semantics (non-intrusive).
- [x] **Collapsible “thinking details”** (peek/expand) with a compact header (Continue-style “Thinking…” / “Thought for 1.2s”).
- [x] **Collapsible tool/activity trace**:
  - [x] Default: **collapsed after completion** (summary only)
  - [x] While running: may be visible (or auto-open), but collapses automatically when the response finishes.
  - [x] Expand: shows steps with status (running/ok/error) and optional details
  - [x] Expand/collapse actually changes layout (not just label text)
- [x] **Streaming response UX**:
  - [x] Show placeholder assistant bubble immediately
  - [x] Stream updates visibly (typewriter/stream) without jank
  - [x] When done, replace streaming placeholder with final assistant message
- [x] **No visual duplication**: at most one “thinking” affordance and one “activity” toggle for the active response region.
- [x] **Deterministic empty/error states** remain explicit and stable.
- [x] **Sources / Used References (clean + deduped)**:
  - [x] Render references in a dedicated “Sources” (or “Used References”) section with consistent styling.
  - [x] **No duplicates**: the same reference does not appear twice in a single response.
  - [x] Links are scannable: compact rows (icon + filename/title + path tooltip), consistent spacing.
  - [x] Clicking a source opens the document deterministically (existing `workbook://...` click behavior preserved).
- [x] **Active LLM indicator (always visible)**:
  - [x] Show the currently active **provider + model** in the **Status Bar** (e.g., `LLM: Ollama llama3.2:1b` or `LLM: OpenAI gpt-4o`).
  - [x] Must be stable + deterministic (no flicker, no transient “unknown” unless config truly unavailable).
  - [x] Truncate if needed, but provide full value via tooltip.
  - [x] Automation-safe: uses centralized `testIds` (no inline `data-testid` strings).
  - [ ] Optional follow-up (not required for MVP): also show in Chat header next to “Chat” if space allows.

#### Explicit non‑goals (separate contracts)
- Edit & rerun / history branching (`docs/Contracts/Chat_Edit_Rerun.md`)
- Tabs/layout docking/splits (`docs/Contracts/Workbench_Tabs_Docking_Splits.md`)
- Live document refresh after tool/LLM file writes (`docs/Contracts/Workbench_Tabs_Docking_Splits.md` — “Live refresh on external writes”)
- Changing providers/backends or implementing true token streaming (UX is independent of provider)
- Reworking the chat composer/input UX (covered by `docs/Contracts/Chat_Composer.md`)

#### Repo touch points (planned)
- `src/components/Sidebar/Chat.tsx` (response rendering: thinking/streaming/activity blocks)
- `src/components/Sidebar/ChatMessage.tsx` (assistant message rendering affordances)
- `src/components/StatusBar.tsx` (add `LLM: <provider> <model>` indicator)
- `src/App.tsx` (plumb active provider/model state into `StatusBar`)
- `src/testing/testIds.ts` (add stable ids for response UX: thinking toggle, activity toggle, streaming bubble)
- `tests/automation-smoke-ui.mjs` (deterministic smoke for response UX)

#### Proof (deterministic smoke)
- [x] **Thinking indicator appears** when send begins (and there is exactly one).
- [x] **Activity auto-collapses after completion** (assert collapsed state reduces visible step rows after response finishes; user can expand).
- [x] **Streaming bubble** appears then final assistant message persists.
- [x] **No duplicate controls**: assert one `[data-testid="chat-thinking-toggle"]` (or equivalent) and one activity toggle in the active response region.
- [x] **Sources are deduped**: send a message that produces refs → assert only one sources section and no duplicate `workbook://...` refs.
- [x] **LLM indicator renders**: Status Bar shows provider+model and updates when config changes.
