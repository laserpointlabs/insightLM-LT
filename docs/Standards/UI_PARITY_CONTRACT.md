# UI Parity Contract (InsightLM‑LT)

This repo follows a **Reference‑First** approach for core UI/UX. The goal is: **stop inventing UI** and instead copy established, proven behaviors.

## Defaults (what “make X” means)

- **Views / Layout / Workbench / Tabs**: copy **VS Code** conventions (layout stability, view containers, collapsible/resize behavior, moving views between containers, persistence).
- **Chat UX**: copy **Continue / Cursor** conventions (composer behavior, wrapping, mentions/context insertion, stable caret, predictable scrolling).

If a feature request does not specify otherwise, these defaults apply.

## Non‑negotiables

- **No invented UX** for core surfaces (views/layout/tabs/chat).
- **Deterministic UX**: explicit empty/error/loading states; no browser `alert/prompt/confirm`.
- **Automation‑safe UI**:
  - Add stable selectors via `src/testing/testIds.ts`.
  - Add/extend deterministic smoke coverage (`tests/automation-smoke-ui.mjs`) for any workflow change.

## “Reference Map” template (required before implementation)

Keep to **≤ 1 page**.

### 1) What are we copying?

- **Surface**: (Views/Layout/Tabs) or (Chat UX)
- **Reference**:
  - VS Code docs (Context7): section/link
  - Continue/Cursor source: repo + file path(s) + commit/tag

### 2) Must‑match behaviors (bullets)

Examples (pick only what applies):
- Autosize rules (min lines / max height / when inner scroll starts)
- Wrapping behavior (word wrap, long token behavior)
- Mention insertion rules (caret stability, no layout shift)
- Collapse/resize behavior (snap, persistence)
- Tab close/rename propagation behavior

### 3) Explicit non‑goals

List what we are *not* implementing/copying.

### 4) Repo touch points

Which local files/components/stores/tests will change.

### 5) Proof (deterministic)

Which smoke step(s) will verify it using `data-testid` only.

## How to ask (one line)

- “Implement **X** with **VS Code parity** (views/layout/tabs) / **Continue parity** (chat UX). **Reference Map first**, then implement, then smoke.”
