# Project Data Access Boundary (Demo Proof)

## Goal (for the end-of-month demo)

Be able to say—and **prove**—that **Chat/RAG can only access the currently-open Project’s data**, not the rest of the machine and not this repo’s source code.

## Definition

- **Project boundary (MVP)**: the configured **workspace dataDir** (see `config/app*.yaml`) and its managed subtrees, especially:
  - `{dataDir}/workbooks/**` (documents, sheets, dashboards, etc.)

## Enforcement principle

Enforce the boundary **in the backend/tool layer**, not just UI:

- All file reads/writes used by Chat/RAG must be restricted to:
  - workbook-scoped paths under `{dataDir}/workbooks/<workbookId>/...`
- Must prevent:
  - absolute paths
  - path traversal (`..`)
  - symlink escape (resolve then validate)

## Current state (what already helps)

- Electron sets `INSIGHTLM_DATA_DIR` for auto-started MCP servers (see `electron/main.ts`).
- `FileService` reads/writes via a workbook-rooted path (see `electron/services/fileService.ts`).

## Gap to close (must fix before demo)

- `mcp-servers/workbook-rag/server.py` currently builds paths like:
  - `{dataDir}/workbooks/<workbookId>/<file_path>`
  - It must **normalize + validate** that the resolved path stays inside the workbook directory.

## Proof (deterministic)

Add an automated “deny” test that attempts to read outside the boundary and must fail:

- Call `workbook-rag` tool `rag_read_file` (or equivalent) with a traversal path (e.g., `../` segments) and assert:
  - The server returns a deterministic error (e.g., “path not allowed”).
  - No file content leaks.

This is the demo-ready answer to: “How do you ensure RAG can’t read the rest of your code?”
