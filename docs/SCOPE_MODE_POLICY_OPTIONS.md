### Scope mode (Scoped vs All) — policy options + “power user vs simple mode” switch

This is a **design note** (not a contract) capturing options for how **Context scoping** should work and how we might support both:

- **Power users** (frequent, intentional toggling)
- **General / simplified deployments** (reduced UI or locked behavior)

We will decide later; this doc is here so we don’t lose the discussion.

---

## Definitions (current mental model)

- **Context**: a named set of workbooks (and optional folders) managed by `context-manager`.
- **Scope mode**: whether Chat/RAG/tools are constrained to the active Context’s workbook set.

Two scope modes:
- **Scoped** (`scopeMode="context"`): limit to the active Context’s workbook set.
- **All (Project)** (`scopeMode="all"`): search across **all workbooks in the current Project** (still within the Project data boundary).

Important: “All” does **not** mean “internet”; it means “all workbooks in this Project”.

---

## Why keep scope mode at all?

Even for power users, scope exists to solve real problems:
- **Precision**: avoid accidental cross-workbook retrieval/citations.
- **Reproducibility**: later you can tell *which scope* produced which answer.
- **Performance**: smaller corpus often yields better answers and fewer irrelevant sources.

We also added **per-message scope badges** so history stays readable when users toggle between modes.

---

## Option set 1: Default mode for a fresh Project

### Option 1A — Default to **Scoped**
**Behavior**: new Projects start in Scoped mode; user toggles to All when desired.

- **Pros**
  - Safer by default (less accidental cross-pollination).
  - Matches the intuition that “Context is the lens.”
  - Better for demos where context-specific answers matter.
- **Cons**
  - Power users may toggle to All frequently.
  - Requires a quick way to set “always All” for some workflows.

### Option 1B — Default to **All (Project)**
**Behavior**: new Projects start in All mode; user toggles to Scoped when they want precision.

- **Pros**
  - Frictionless “just search everything in my project” experience.
  - Aligns with power users who treat Projects as the main boundary.
- **Cons**
  - Higher risk of accidental cross-workbook answers/citations.
  - “Why did it use that other workbook?” confusion unless the UI is very explicit.

**Notes**
- Regardless of default, scope mode should remain **project-scoped** and persisted.
- Copy change: label everywhere as **All (Project)** (not just “All”).

---

## Option set 2: Master “simple vs advanced” control (deployment / user preference)

Goal: keep **Option A (first-class everyday toggle)** for power users, while allowing an org or user to simplify or enforce behavior.

### Option 2A — Master switch: **Hide**
**Behavior**: scope toggle is hidden from the main chat UI, but the current mode still exists.

- “Simple mode”: UI shows only the current scope state (read-only), or shows nothing until a user opens Settings.
- The mode can still be changed in Settings (or via an “Advanced…” affordance).

- **Pros**
  - Reduces visual clutter for less-advanced usage.
  - Still allows power users to opt back into advanced control.
- **Cons**
  - Discoverability: users may not understand why results differ if they can’t see the toggle.

### Option 2B — Master switch: **Lock**
**Behavior**: scope mode is forced to a chosen value (Scoped or All(Project)) and cannot be toggled unless unlocked.

- **Pros**
  - Deterministic for regulated / controlled deployments.
  - Prevents accidental “All” queries in safety-critical workflows.
- **Cons**
  - Can frustrate power users if the chosen lock is wrong for their workflow.

**Variants**
- Lock-to-Scoped (safest): enforce context discipline.
- Lock-to-All (broadest): enforce project-wide search.

---

## Recommended combined stance (covers both A and B)

1. Keep **Scope toggle (Scoped / All(Project))** as a **first-class everyday control** in Chat (power-user default).
2. Add a **master control** that can:
   - **Hide** the toggle (simple UI), and/or
   - **Lock** the mode (enforced behavior).
3. Ensure the rest of the UI is consistent:
   - one control point (Chat) for changing
   - other indicators are mirrors (read-only) to avoid “three places to change it”
4. Keep the history readable:
   - per-message scope badges remain mandatory (already implemented)

---

## Implementation sketch (future)

- Persist the master preference per Project (or globally):
  - `scopeUiMode: "advanced" | "simple"`
  - `scopeLock: null | { mode: "context" | "all" }`
- Enforce lock at the `contextScope.setMode` boundary:
  - UI disables toggle when locked and shows clear tooltip why.
  - Main process could also refuse `setMode` when locked (defense-in-depth).

---

## Open questions (to decide later)

- Should the master switch be **per user**, **per project**, or **per deployment**?
- If locked, should the user see a “request unlock” / “admin policy” hint?
- Should “All” mode change how Context selection behaves (e.g., still show active Context but mark it as “not enforced”)?

