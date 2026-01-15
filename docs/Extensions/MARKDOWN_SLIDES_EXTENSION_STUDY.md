# Markdown Slides (in-app, no new file type) — Feasibility Study

## Goal

Add a **Markdown → slideshow** capability where a user can **right‑click a `.md` file and “Show as Slides”**.

Constraints from you:

- No `.slides` / `.marp` file types.
- No Marp/MARP dependency required; we can implement our own.
- Slides are **delineated inside the Markdown** using explicit markers (not a separator that collides with normal Markdown).

## Current repo reality (what we can leverage today)

### 1) We already have a Markdown renderer/viewer

The app already supports Markdown viewing/editing (including Mermaid). A slides mode can reuse the same Markdown rendering stack per-slide.

### 2) We already have “open tab types” beyond files

The app can open different tab/doc types (document, dashboard, chat, config, extension details). “Slides” can be implemented as another tab type that references an existing Markdown file.

### 3) Context menus exist (right-click) and are the right UX surface

You want: **right-click Markdown → Show as Slides**. That maps naturally to the existing file/workbook tree context menus (implementation detail depends on where those menus live).

## Target user experience (what “good” looks like)

### A) Right-click action

- Right-click a `.md` file in the Workbooks tree.
- Action: **Show as Slides**
- Result: opens a new tab (e.g., “`<filename>` (Slides)”) that renders the same file as a slide deck.

### B) Slide delimiter inside Markdown

Baseline proposal (explicit `start slide` + explicit `end slide`):

- A slide is a block of Markdown wrapped by explicit markers (single line markers):

```
start slide
... markdown content for the slide ...
end slide
```

Rationale: this avoids collisions with normal Markdown syntax (like horizontal rules).

Marker semantics:

- **Start slide**: `start slide`
- **End slide**: `end slide`

Notes:

- Markers should be recognized only when they appear on their own line (ignoring surrounding whitespace).
- Content outside any `start slide ... end slide` blocks is treated as **normal Markdown** (not part of the deck), unless we choose a “wrap whole doc” behavior later.

Alternate marker format (still supported if you prefer it later):

```
<!-- slide -->
... markdown content for the slide ...
<!-- slide! -->
```

And optionally allow end marker `<!-- slide\ -->` if you want the backslash style.

### C) Slide navigation

MVP behavior:

- Next/prev slide buttons (and keyboard):
  - Right/Left arrows
  - PageDown/PageUp
  - Space to advance (optional)
- Slide counter: “3 / 12”
- Fit-to-window scaling (so slides are usable in the document pane)

Non-goals for MVP:

- Presenter mode
- PDF/PPTX export
- Animations/themes beyond a simple default

## Implementation approaches (without new file types)

Below are the viable ways to implement “Show as Slides” for `.md` without introducing `.slides`.

### Option 1 — Add a “Slides” tab type that points at an existing `.md` file (recommended)

**Idea**

- Keep `.md` as `.md` (no file type changes).
- Add a context-menu action that opens a **Slides viewer tab** for the selected Markdown file.

**Pros**

- Exactly matches the UX you asked for.
- No ambiguity in file handler routing (we don’t need `.slides`).
- Keeps normal Markdown viewing/editing unchanged.

**Cons**

- Requires adding a new tab type + viewer component.

### Option 2 — Add a toggle inside the Markdown viewer (“Document” vs “Slides” mode)

**Idea**

- Open Markdown normally, but add a toggle to switch rendering mode to slides.

**Pros**

- No new tab type; single place to view/edit.

**Cons**

- Harder to keep editing UX clean (slides mode typically wants keyboard navigation).
- State persistence becomes trickier (per-tab mode, per-file default, etc.).

### Option 3 — Use a command palette / slash command instead of context menu (not your preference)

You explicitly want right-click, so this is a fallback only.

## Parsing + rendering strategy (for our own implementation)

### A) Parsing slides

Two levels of sophistication:

- **MVP (marker scan)**: scan the markdown line-by-line, extracting blocks between:
  - `start slide` and `end slide`
  - (optionally also accept `<!-- slide -->` and (`<!-- slide! -->` or `<!-- slide\ -->`))
  - Fast to build; deterministic; avoids fenced-code edge cases better than simple string split.
- **Robust (AST-based)**: parse markdown to an AST (remark) and treat explicit markers as slide boundaries.
  - Avoids edge cases with fenced code blocks, etc.

### B) Rendering each slide

- Reuse the existing Markdown renderer/viewer pipeline for each slide’s content.
- Wrap each slide in a “slide frame” component that provides:
  - scaling
  - background
  - navigation UI

## Concrete MVP plan (minimal scope, highest value)

### MVP features

- Right-click `.md` → **Show as Slides**
- Slide delimiter: explicit markers `start slide ... end slide` (optionally also accept `<!-- slide --> ... <!-- slide! -->`)
- Next/prev navigation + slide counter

### Deferred

- Themes
- Presenter view
- Export (PDF/PPTX)

## Open questions (to lock down before coding)

1) Should we require every slide to be explicitly closed (`end slide`) or allow implicit-close-on-next-start?
2) If a file has **zero slide blocks**, should “Show as Slides” show an empty state (“No slides found”) or treat the whole document as one slide?
3) Do you want per-slide titles (e.g., first `# Heading` becomes the slide title) for a table-of-contents later?

## Notes on “copying JupyterLab slideshow”

Jupyter’s slideshow story typically involves notebook cell metadata + Reveal.js-style rendering. We can borrow UX ideas (keyboard nav, presenter view later), but for Markdown the simplest path is:

- parse Markdown into slides
- render each slide with our Markdown renderer
- provide deterministic navigation

