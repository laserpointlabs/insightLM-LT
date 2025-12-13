## Implementation Plan: Contexts, Data Workbench, Chat Uplift, and Context-RAG

This document captures a staged plan to make contexts first-class, add scoped data subscriptions, uplift chat, and align RAG/dashboards with contexts. It complements the vision doc and the `context-rag` plan.

### Phasing (high level)
1) Contexts view & scoping
2) Data Workbench with scoped subscriptions (sample Postgres)
3) Chat uplift (providers, tabs, commands, modes, rules)
4) Context-RAG integration (primary) with legacy RAG fallback
5) Dashboards & datasets scoped by context; sub-workbooks
6) Extensions/artifacts indexing (ontology/SysML/analytics/trading)
7) Polish: health/telemetry, updates (releases/auto-update already covered)

### Contexts (first-class view)
- Add “Contexts” view alongside Chat / Workbooks / Dashboards.
- Context = name + active workbooks (incl. one-level sub-workbooks) + data subscriptions + extension flags.
- Activation sets scope for RAG/search/chat/dashboards; only active context resources are used.
- Metadata: context id/name; list of workbooks/sub-workbooks; data sources; enabled extensions.

### Data Workbench (scoped subscriptions)
- UI to register external sources (start with sample Postgres + tables).
- Context/workbook subscribes to source; only subscribed datasets are visible to that context.
- Workbook “data” folder lists linked datasets; links are context-aware to prevent scope bleed.
- RAG indexing uses these subscriptions to ingest only context-linked datasets.

### Chat uplift (configurable, context-first)
- Providers: config (YAML/JSON) for multiple profiles (OpenAI, Claude, local Llama/Ollama).
- Tabs: multiple chats with persistent history; history list accessible; per-tab rules/prompts.
- Input: multi-line textarea; rules; `@context` insertion; `/commands` (actions like `/whitepaper …`).
- Modes: Agent (CRUD-capable tools for files/workbooks/data/dashboards/extensions), Plan, Debug (verbose traces).
- Commands/actions: configurable; map to toolflows (e.g., generate whitepaper from context docs, refresh dashboard, create notebook).
- Context-first: show active context; warn if none; scope tool calls to active context.

### Context-RAG (primary) + legacy fallback
- Primary: `context-rag` (vector+rerrank, LanceDB), scoped to active context (workbooks/sub-workbooks/datasets/dashboards/chats/extensions artifacts).
- Fallback: existing `workbook-rag` if primary fails (health/timeout/error); log fallback.
- Optional policy MCP (`content-policy`): PII/CUI filters on ingest and response (block/redact/annotate), with logging.
- Health: `rag/health`, latency/error logging, policy logs.

### Dashboards and datasets
- Dashboards pull only from datasets/workbooks in the active context.
- Dashboard results/summaries can be indexed into `context-rag` with metadata.

### Sub-workbooks
- Support one-level sub-workbooks as namespaces; include metadata in RAG filters and context scoping.

### Extensions/artifacts
- Index ontology (ODRAS), SysML, analytics/trading outputs as documents with metadata (context, workbook, type).
- Identify all objects (workbooks, contexts, datasets, dashboards, processes, events) with IRIs for stable, global references across instances.

### Telemetry & safety
- Health checks (RAG, policy), fallback logs, policy decision logs.
- Data remains in app data dir; updates non-destructive; versioned migrations if needed.

### Process Workbench (orchestrated flows)
- Goal: let users define/execute processes (workflows) that can call MCP tools (query data, clean data, refresh dashboards, write outputs).
- Model: process definitions (steps, inputs, outputs, triggers); execution engine that runs steps via MCP tool calls/commands.
- Use cases: “Query data source → clean data → update dashboard → write to folder”; “Import loads → validate → run FEA → publish margins.”
- Hooks: can be triggered manually, on schedule, or by events (see below).

### Event Dashboard / Pub-Sub (shared artifacts)
- Goal: users can publish dashboards/artifacts; others subscribe and get updates (events).
- Model: publish/subscribe with notifications and optional auto-triggered workflows.
- Events: dashboard updated/published; dataset updated; process completed; load case published.
- Actions on event: notify subscribers; optionally kick off a Process Workbench flow (e.g., import loads, verify, run FEA, update margins).
- Security/scope: subscriptions should respect context/permissions; artifacts are shared via a controlled channel (not general file system broadcast).
- Decentralized/relay MVP: lightweight relay (WebSocket/MQTT) with auth/ACL per context/topic and signed events; support last-value or short buffer for late joiners; P2P possible later via relay with signatures.
- Event schema: id, type, context_id, workbook_id (optional), topic, version, ts, publisher_id, signature, payload_ref (URL/hash), summary; optional policy hook (PII/CUI) on emit/receive; size/rate limits; versioned artifacts to detect changes.
- Event types include thresholds/monitors (stock price, weather, KPIs), artifact updates (dashboards, datasets, loads), system/process events.

### Staged tasks (suggested)
1) Contexts view + activation + apply scope to RAG/search/chat/dashboards.
2) Data Workbench with sample Postgres, subscription model, workbook data folder mapping.
3) Chat uplift: providers config, tabs/history, commands/actions, modes/rules, multi-line input, context injection.
4) Integrate `context-rag` primary with legacy fallback; optional policy hooks.
5) Dashboard/dataset scoping to context; sub-workbook metadata.
6) Process Workbench (workflow definitions/execution) and Event Dashboard/pub-sub wiring (relay-based MVP with auth/ACL, signed events, last-value/buffer).
7) Extensions artifacts indexing; IRI scheme for all objects.
8) Polish: telemetry, health, docs; release/auto-update already documented.
