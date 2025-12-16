## context-rag (Advanced RAG) - MCP server

This server will provide vector + rerank RAG for InsightLM, with legacy `workbook-rag` as fallback.

### Status
- Plan: see `PLAN.md`
- Code: not yet implemented

### Intended features
- Vector search (LanceDB) + rerank (configurable provider)
- Ingestion of files/notebooks/chats/dashboards/datasets/extension artifacts with metadata (workbook, sub-workbook, context)
- Incremental ingest (mtime/hash), rebuild index command
- Health endpoint (`rag/health`)
- Optional policy integration (PII/CUI) on ingest/response
- Fallback to `workbook-rag` if primary fails

### Configuration (stub)
- `command`: python or node entrypoint (TBD)
- `args`: stdio mode (TBD)
- `env`:
  - `LANCEDB_PATH`: storage location
  - `OPENAI_API_KEY`: embeddings (example)
  - `RERANK_API_KEY`: rerank provider (if used)
  - `VECTOR_RAG_ENABLED`: enable primary
  - `RAG_FALLBACK_ENABLED`: enable fallback to `workbook-rag`
  - `POLICY_INGEST_ENABLED`: enable policy MCP on ingest
  - `POLICY_RESPONSE_ENABLED`: enable policy MCP on response
  - `POLICY_MODE`: `block` | `redact` | `annotate`

### Next steps
1) Scaffold server entry (stdio) with health/search/ingest endpoints.
2) Add config loader and hook up LanceDB client, embedding model, rerank provider.
3) Wire parsers (reuse document-parser MCP or shared libs) for PDFs/Word/MD/TXT/CSV/XLSX.
4) Implement chunking/metadata, incremental ingest, rebuild command.
5) Implement search (vector + rerank + filters) and response formatting with sources.
6) Add optional policy hooks and logging; fallback logging to `workbook-rag`.
7) Add tests with deterministic fixtures across doc types, chats, dashboards.















