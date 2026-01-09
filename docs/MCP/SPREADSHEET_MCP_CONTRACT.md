# Spreadsheet MCP Contract (Insight Sheets)

## Problem

When a user asks an LLM to “create a spreadsheet”, the model does not reliably know the `.is` file format unless it has seen an example. This is fragile and causes inconsistent sheet creation/editing.

## Goal

Make spreadsheet authoring **tool-driven and deterministic**:

- The LLM **never guesses** `.is` JSON.
- The LLM uses a small set of **Spreadsheet MCP tools** to create/edit sheets.
- The renderer reads/writes `.is` files, but the model only interacts through tools.

## Contract principles

- **Single canonical schema** for `.is` (versioned).
- **Round-trip safe**: tools that write must be readable back via tools.
- **Deterministic**: tools return structured outputs; avoid prose-only responses.
- **Project boundary**: tools only read/write under the current project/workbook scope.

## Required tool surface (MVP)

### Create / Open

- `spreadsheet.create`
  - inputs: `workbook_id`, `name?`
  - outputs: `file_path`, `sheet_ids`, `metadata`

- `spreadsheet.open`
  - inputs: `workbook_id`, `file_path`
  - outputs: full structured sheet (metadata + sheets + viewState if present)

### Read (for LLM grounding)

- `spreadsheet.get_schema`
  - outputs: schema version + minimal canonical example(s)

- `spreadsheet.get_range`
  - inputs: `workbook_id`, `file_path`, `sheet_id`, `range` (e.g. `A1:C10`)
  - outputs: structured cell values + formulas + formats

### Write

- `spreadsheet.set_cells`
  - inputs: `workbook_id`, `file_path`, `sheet_id`, `cells` (map of `A1` → `{ value|formula, format? }`)
  - outputs: `ok`, `changed_cells`, `modified_at`

- `spreadsheet.set_view_state`
  - inputs: `column_widths`, `row_heights`, frozen panes, etc.
  - outputs: `ok`

### Sheet-level ops

- `spreadsheet.add_sheet`, `spreadsheet.rename_sheet`, `spreadsheet.delete_sheet`

## Non-goals (for MVP)

- Full Excel parity
- Collaborative editing
- External MCP SaaS dependencies

## Notes

- We already have `mcp-servers/spreadsheet-server` + `.is` files; the gap is the **authoring contract** + **tools that actually read/write `.is`** (not placeholders).
- Parity reference for tool coverage: Univer MCP Start Kit “Currently Supported MCP Tools” list: `https://github.com/dream-num/univer-mcp-start-kit`
