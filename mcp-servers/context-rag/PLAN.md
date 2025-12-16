## Advanced RAG (context-rag) - Plan

This stays with MCP servers to avoid getting lost; it captures the plan for the new vector + rerank RAG server with legacy fallback.

### Goals
- Primary RAG uses vectors + rerank (LanceDB + reranker).
- Keep current `workbook-rag` as fallback if vector path fails.
- Scope to InsightLM contexts: active workbooks (and one-level sub-workbooks), dashboards/results, datasets, notebooks, chats, and extension artifacts (ontology/SysML/analytics/trading, etc.).

### Architecture
- New MCP server: `context-rag` (Python or Node; LanceDB storage on disk under app data dir).
- Embeddings: OpenAI embeddings (configurable model).
- Vector store: LanceDB; tables include metadata (workbook_id, sub_workbook, context, path, filename, doc_type, chunk_id, offsets, mtime/hash).
- Rerank: Cohere/OpenAI rerank (configurable) over top-K vector hits.
- Fallback: `LLMService` uses primary server name `context-rag`, falls back to existing `workbook-rag` on health/timeout/error.

### Content to index
- Workbooks + one-level sub-workbooks (as metadata namespaces).
- Files: PDFs/Word/MD/TXT/CSV/XLSX (and similar office/text formats).
- Notebooks: markdown + code cells as text chunks with source notebook metadata.
- Chats: persisted chat transcripts (user/assistant) as documents with timestamps/session IDs.
- Dashboards: generated results and summaries; include datasets used by dashboard tiles.
- Datasets: imported/tabular data referenced by dashboards or workbooks.
- Extensions/artifacts: ontology (ODRAS), SysML, analytics/trading outputs—store as text/structured JSON serialized to text with metadata.

### Ingestion
- Chunking: configurable size/overlap; store start/end offsets.
- Incremental: compare mtime/hash; re-chunk only changed items.
- Namespacing: per workbook/sub-workbook; include context tag if available.
- Batch embeddings with rate limits/retries; log failures.
- “Rebuild index” command to purge/reindex LanceDB tables if needed.
- Parsers: reuse current PDF/Word/Excel/CSV/MD readers; normalize to text before chunking. For tabular (CSV/XLSX), derive both raw text chunks and lightweight row/summary text for better retrieval.
- Best-practice chunking/embeddings: start with fixed-size chunking + overlap; keep model configurable (e.g., OpenAI embeddings). See also guidance on vector DB + rerank patterns (e.g., LanceDB + rerank) and chunking strategies for mixed doc types [docs.continue.dev/guides/custom-code-rag](https://docs.continue.dev/guides/custom-code-rag).

### Query path
- Embed query → vector search (top-K, e.g., 30) → rerank (top ~20) → return top N chunks/files with scores/snippets/metadata.
- Filters: by workbook, sub-workbook, doc_type; respect active Context to limit scope.
- Response: include sources with workbook/sub-workbook/path, score, and snippet; LLMService tracks sources as today.

### Health & observability
- `rag/health` endpoint (primary) plus latency/error logging.
- Log when falling back to legacy `workbook-rag` (reason: timeout/error/health-fail).
- Basic metrics to add later: index size, last index time, embed/rerank errors.
- Policy logging: log when content is blocked/redacted by policy (ingest or response).

### Config/flags
- Primary server name: `context-rag`.
- Fallback server name: `workbook-rag`.
- Feature flags: `vector_rag_enabled`, `rag_fallback_enabled`, `policy_ingest_enabled`, `policy_response_enabled`.
- Config: LanceDB path, embedding model, rerank provider/model, chunk size/overlap, top-K, timeouts; policy mode (block vs redact/annotate).

### Next steps (not implemented yet)
- Scaffold `context-rag` MCP server with health, search, ingest endpoints.
- Wire LLMService to prefer `context-rag` and fall back to `workbook-rag`.
- Add ingestion commands/hooks for files, notebooks, chats, dashboards/results, datasets, extension artifacts.
- Add tests with deterministic fixtures for indexing and querying.
- Add optional `content-policy` MCP integration (PII/CUI review): ingest filter and response filter with logging.

### TODOs (checklist)
- [ ] Scaffold MCP server skeleton (`context-rag`), stdio entrypoint, config.
- [ ] Choose vector store client (LanceDB), embedding model, rerank provider; make configurable.
- [ ] Implement parsers and normalization for PDFs/Word/MD/TXT/CSV/XLSX; include tabular-to-text summaries.
- [ ] Implement chunking with configurable size/overlap and metadata (workbook/sub-workbook/context/offsets).
- [ ] Implement incremental ingest (mtime/hash), batch embeddings with rate limits, and rebuild command.
- [ ] Implement search: vector top-K + rerank + filters; return snippets + metadata.
- [ ] Add `rag/health`, latency/error logging, and fallback logging to legacy RAG.
- [ ] Integrate in LLMService with primary/fallback server names and flags.
- [ ] Add deterministic test fixtures (index + query) across doc types and chats/dashboards.
- [ ] Design optional `content-policy` MCP (PII/CUI) and wire ingest/response filters with logging and toggles.













