### Reference Map — **Demo Readiness (Deloitte EOM) — AC1000 + Trade Study + Conceptualizer**

This contract defines what we will demo to Deloitte at the end of the month, and what “ready” means.

Primary goals:
- Make **Demo #1 (AC1000)** and **Demo #2 (Trade Study)** feel polished, repeatable, and grounded in real artifacts.
- Add **Demo #3 (Conceptualizer)**, which requires new extension/tooling to support: **CDD → Requirements → Ontology mapping → Concept outputs**.

Demo rehearsal issue tracking:
- Use `docs/Status/DEMO_EOM_ISSUES.md` to log demo-critical bugs/issues found during rehearsal so we can burn them down before the live demo.

Hard constraints:
- **Deterministic UX** (explicit empty/error/loading states; no `alert/prompt/confirm`).
- **Automation-safe** (selectors from `src/testing/testIds.ts`; deterministic smoke proof in `tests/automation-smoke-ui.mjs`).
- **Decoupled + fail-soft** (MCP/tool routing stays decoupled; demos still load even if optional services are down).
- **UI parity contract**: no invented UX on core surfaces (views/layout/tabs/chat). Demo UX changes must follow `docs/Standards/UI_PARITY_CONTRACT.md`.

---

## Upstream / reference anchors (authoritative)

Repo reference points we must preserve:
- Demos loading + context activation (existing):
  - `electron/services/demoService.ts` (`DemoService.loadDemo("ac1000" | "trade-study")`)
  - `electron/services/demoSeedService.ts` (seed demo workbooks + dashboard + walkthrough docs)
  - `tests/automation-smoke-ui.mjs` (already asserts `demos.load("ac1000")` + `demos.load("trade-study")`)
- Trade Study walkthrough precedent (existing):
  - `docs/Customer_UseCase/uav_trade_study_video_script.md`

---

## Must‑match behaviors (demo readiness checklist)

### A) Demo reliability (all demos)
- [ ] **A1. One-click load**: each demo is loadable via the existing Demos surface (or equivalent existing command), without manual file copying.
- [ ] **A2. Deterministic scoping**: loading a demo forces **SCOPED** mode and activates a deterministic Context (best-effort; fail-soft if context-manager MCP is down).
- [ ] **A3. Deterministic artifacts**: each demo has a canonical set of artifacts (docs/sheets/notebooks/dashboards) that exist after load and match the script.
- [ ] **A4. Clear walk-through doc**: each demo workbook contains a `video_walkthrough.md` (or equivalent) that is accurate and can be read verbatim.
- [ ] **A5. Fail-soft**:
  - If an optional MCP server (context-manager, conceptualizer, etc.) is down, demo still opens and shows an explicit error/empty state with a retry path.
  - No “blank white screen” failure modes for seeded sheets/notebooks.
- [ ] **A6. Smoke proof**: `tests/automation-smoke-ui.mjs` covers “load → verify artifacts exist → open key artifacts” for each demo.
- [ ] **A7. Chat context behavior is understood (current capability)**:
  - The LLM receives the **active chat thread transcript** as message history for the current request (context-scoped thread).
  - Chat history is **not currently RAG-searchable** across prior sessions/contexts (no “search past chats” tool/index yet).
  - Demo scripts must not rely on “search my old chats” unless/until we implement chat indexing/retrieval.
- [ ] **A8. Thinking/progress indicator is visibly animating during RAG/tool execution (demo-critical)**:
  - When long-running work happens (especially `rag_search_content` / RAG reads, or other tool bursts), the UI must show an **actively animating** thinking indicator (not a static ellipsis).
  - Users must be able to tell “it’s working” vs “it froze” while waiting.
  - Reference contract: `docs/Contracts/Chat_Response_UX.md` (Continue/Cursor parity thinking indicator + activity trace).

### B) Demo narrative coherence (all demos)
- [ ] **B1. “Artifacts-first” narrative**: show that the assistant is grounded in workbooks via `workbook://...` references.
- [ ] **B2. Traceability**: outputs cite sources (file links) and can be reopened to verify.
- [ ] **B3. Repeatable iteration loop**: change an input artifact → regenerate derived artifact(s) → dashboard/chat reflect the change.

---

## Demo #1 — AC1000 (improvements)

### Current state (what exists today)
- Demo load is implemented: `DemoService.loadDemo("ac1000")`
- Seeded workbooks:
  - `ac1000-main-project` (“AC-1000 Aircraft”)
  - `test-schedule-ac1000`
  - `supplier-agreements`
  - `project-budget`
  (see `electron/services/demoService.ts`)

### Demo goal (what Deloitte should understand)
Show a realistic **program execution workflow** (weapons-integration / vendor risk-reduction style) using the tool as the program’s “operating system”:
- multi-workbook scope (program + schedule + suppliers + budget)
- capture and organize **pilot/vendor meeting notes** and **vendor information/proposals**
- manage **requirements + decisions + risks** as living artifacts
- generate **periodic summaries** for internal stakeholders and external vendors
- end with a concise **program closeout summary** grounded in the project record

### Must‑add / improve artifacts (planned)
- [ ] **AC1. Walkthrough doc**: add/update a `video_walkthrough.md` under the AC1000 main workbook.
- [ ] **AC2. Program structure is not “random markdown”**:
  - **One-level folder constraint**: keep the workbook structure **single-depth** (no nested folder trees).
  - Seed a small, deterministic folder set inside `ac1000-main-project` (example):
    - `notes/` (meeting notes)
    - `vendors/` (vendor packets / summaries)
    - `requirements/` (requirements + constraints)
    - `decisions/` (decision log)
    - `risks/` (risk register)
    - `briefs/` (periodic briefs + closeout summary)
  - Include an `INSTRUCTIONS.md` playbook at the workbook root that explains “what this workspace is” and how to operate it (repeatable prompts + where to write outputs).
- [ ] **AC3. Data → docs (generate, don’t hand-type)**:
  - Demonstrate pulling information from structured-ish inputs (meeting notes, vendor packets, requirements docs) and having the LLM generate derived artifacts.
  - Keep this deterministic by making the **inputs** explicit, and writing derived outputs to fixed paths.
- [ ] **AC4. Canonical requirement set**:
  - Store requirements with stable IDs (either Markdown with IDs or an Insight Sheet `.is`).
  - Requirements must be linkable (IDs and `workbook://...` citations).
- [ ] **AC5. “Derived output” loop (program monitoring)**:
  - Periodic summary artifacts (e.g., `program/briefs/weekly_status.md`) that can be regenerated.
  - Closeout artifact (e.g., `program/briefs/program_closeout.md`) grounded in the full record.
- [ ] **AC6. Demo-to-demo handoff (requirements output for Trade Study)**:
  - End Demo #1 by producing a **requirements baseline** suitable for Demo #2 (trade study), saved as a deterministic artifact (preferred: an Insight Sheet).
  - This makes the demos feel continuous: Demo #1 = “discover/capture requirements” → Demo #2 = “evaluate options against those requirements.”
  - Handoff artifact (proposed):
    - `workbook://uav-trade-study/documents/trade/requirements.is` *(or update the existing `trade/disaster_response_requirements.md` if we keep it markdown)*
  - Must include stable requirement IDs and traceability back to Demo #1 inputs (meeting notes / vendor packets).
- [ ] **AC4. Dashboard proof**:
  - Seed a dashboard (like Trade Study does) that summarizes the program status from the AC1000 artifacts.
- [ ] **AC5. Chat script prompts**:
  - Provide 2–3 copy/paste prompts in the walkthrough:
    - “summarize key risks from … and save to …”
    - “produce a PDR briefing slide outline from … and save to …”
    - “identify MOS < 0.25 items and propose actions; cite analysis docs”

### Proof (deterministic smoke)
- [ ] Load `ac1000` demo → assert workbooks exist → open AC1000 key docs → assert viewer mounts.
- [ ] Assert scoped context is active and consistent with the demo.

---

## Demo #2 — Trade Study (improvements)

### Current state (what exists today)
- Demo load is implemented: `DemoService.loadDemo("trade-study")` which loads workbook `uav-trade-study`.
- Seeded workbook already includes:
  - Canonical sheet: `trade/decision_matrix.is`
  - Notebook: `trade/trade_study.ipynb` (writes `trade/results/summary.json` + `trade/results/study_report.md`)
  - Dashboard: “UAV Trade Study Dashboard”
  - Walkthrough: `trade/video_walkthrough.md`
  (see `electron/services/demoSeedService.ts` and `docs/Customer_UseCase/uav_trade_study_video_script.md`)

### Demo goal (what Deloitte should understand)
Show “model → analysis → communication” loop:
- **Sheet = truth**
- **Notebook = analysis**
- **Results = derived artifacts**
- **Chat + Dashboard = briefing layer**
- **SCOPED** ensures grounding
 - Demo #2 starts from a **requirements baseline generated in Demo #1** (handoff), not from a pre-canned “perfect” requirement set.

### Must‑add / improve artifacts (planned)
- [ ] **TS0. No new extensions**:
  - Improve the demo using existing **Sheets** + **Jupyter** extensions only (no new extension work required for the Trade Study demo).
- [ ] **TS0.1 Requirements handoff is first-class**:
  - The trade study uses the Demo #1 output requirements as the canonical baseline (sheet or markdown), and citations trace back to those artifacts.
  - If requirements are edited, the sheet/notebook results are regenerated and the dashboard updates accordingly.
- [ ] **TS1. Better “real trade study” method (not just weighted scoring)**:
  - Separate **hard constraints** (feasibility) from **soft preferences** (value trade-offs).
  - Make “unknowns” first-class: identify missing specs/data and flag them explicitly instead of silently assuming.
  - Keep the workflow grounded in artifacts (sheet + notebook + generated outputs), not in ad-hoc chat-only reasoning.
- [ ] **TS2. Add a “missing information / data gaps” artifact** (derived):
  - Generate `trade/results/data_gaps.md` (or similar) listing:
    - missing fields per alternative (e.g., payload, endurance, wind tolerance, cost, sensor quality)
    - which COIs/constraints are blocked by missing data
    - recommended follow-ups (what to ask vendors / SMEs)
- [ ] **TS3. Add a “feasibility / constraints matrix” artifact** (derived):
  - Generate `trade/results/feasibility_matrix.md` (or `.csv/.json`) that clearly shows:
    - pass/fail/unknown for each alternative vs each hard constraint
    - rationale + citations to the source files
- [ ] **TS4. Optional: Multi-UAV “mix” study (portfolio selection)**:
  - Instead of choosing a single UAV, evaluate simple mixes like “5 of these + 2 of these + 1 of these” under constraints:
    - coverage requirement, endurance requirement, deployment time, budget ceiling, etc.
  - Keep deterministic by constraining the search space (small integer ranges) and producing:
    - `trade/results/mix_recommendation.md`
    - `trade/results/mix_candidates.json` (top N mixes + scores/constraints)
- [ ] **TS5. Stronger “reset derived outputs” story**:
  - Ensure the walkthrough covers clearing/deleting derived artifacts, then regenerating via notebook.
- [ ] **TS6. Deterministic notebook execution UX**:
  - If notebook execution is flaky, add guardrails (explicit error state, clear logs, predictable completion cue).
- [ ] **TS7. Dashboard robustness**:
  - Ensure dashboard tiles can be refreshed deterministically and recover from missing/empty outputs with explicit empty states.
- [ ] **TS8. Optional: SysML v2 “light model” artifact (no new extension required for EOM)**:
  - Add a minimal SysML v2 model file to the trade study workbook as a **companion artifact** for trade framing (structure, interfaces, constraints).
  - Store it as a plain text file (viewable in the existing text viewer); any rich SysML workbench/graph UI is a future extension.
  - Proposed path(s):
    - `trade/model.sysml` (or `trade/model.sysml2` if we prefer explicitness)
  - Keep it demo-light:
    - a few packages/parts/requirements references
    - a small constraint block that ties back to the feasibility constraints in the sheet/notebook

### Proof (deterministic smoke)
- [ ] Load `trade-study` demo → assert seeded workbook exists → open `decision_matrix.is` → assert spreadsheet viewer mounts.
- [ ] (Best-effort) run notebook cell → assert derived artifacts exist and persist after save/reopen (already partially covered; keep stable).

---

## Optional demo module — Document Management (Agreements + Status Dashboard) *(candidate)*

This is a lightweight “platform breadth” demo module showing the tool as a generic **document ops** system (not engineering-specific).
It is intentionally simple and should not require new core UI beyond Workbooks/Folders/Dashboards/Chat.

### Demo goal (what Deloitte should understand)
- The “blank canvas” can be turned into a **monitoring system** with minimal structure: documents → extracted/derived summaries → dashboards.
- The app can manage real operational document sets (NDAs, supplier agreements, contracts).
- Users can organize docs into **status folders** and get an **at-a-glance dashboard** (counts, expirations, out-for-signature).
- Chat can answer questions grounded in the scoped workbook(s) and generate/update summary artifacts.

### Proposed artifacts / structure (minimal)
- Workbooks (examples):
  - `supplier-agreements` (already seeded; can be extended)
  - Optional: `ndas`, `contracts`
- Within each workbook, create a deterministic folder structure (example):
  - `Active/`
  - `In Process/`
  - `Out for Signature/`
  - `Archive/`
- Instructions / playbook (to make the “blank canvas → system” pattern explicit):
  - `monitoring/INSTRUCTIONS.md`
    - Explains why the workbook is structured this way (folders = status lanes)
    - Defines required metadata fields for each agreement doc
    - Defines the repeatable operating procedure:
      - how to ask Chat to generate/update `monitoring/expiration_summary.md`
      - how to interpret the dashboard tiles
      - how to move documents between status folders (and what that means)
- Documents:
  - Store agreements as Markdown (or PDFs if already supported), with a few consistent metadata fields at top:
    - counterparty, effective date, expiration date, status, owner
- Derived monitoring artifacts (generated/updated by LLM):
  - `monitoring/expiration_summary.md`
    - Prompt pattern: “scan all NDAs, find expirations soon, write/update this markdown summary”
    - Dashboard tiles read from this file for a stable “monitoring” feel
- Dashboard:
  - A small set of tiles:
    - “How many are Out for Signature?”
    - “Which agreements expire in the next 60/90 days?”
    - “Summarize key risks/clauses across Active agreements” (best-effort; explicit empty states)

### Future extension (not required for Deloitte EOM)
- When we add **Events** and **Datasets** workbenches, this same pattern becomes “monitor anything”:
  - documents, data feeds, project events, expiring tasks, threshold monitors

### Proof (deterministic smoke)
- [ ] Demo load produces the workbooks + folders and at least a handful of documents.
- [ ] Dashboard renders at least one tile with a deterministic non-empty result.
- [ ] Chat can answer a scoped question with citations to specific agreement files.

---

## Demo #3 — Conceptualizer (new) — CDD → Requirements → Ontology mapping → Concept outputs

### Demo goal (what Deloitte should understand)
Show a conceptual engineering workflow:
- Ingest a **CDD-like document**
- Extract **requirements** into a structured artifact (preferred: Insight Sheet)
- Use an **ontology** to map each requirement to:
  - **Process / Function / Component** (P/F/C) or equivalent decomposition
- Produce a **concept output** that is traceable back to requirements and ontology mappings

Inspiration / precedent (internal):
- This demo is a simplified “ReqFlow” / ODRAS-style flow:
  - CDD → requirements extraction
  - requirements → ontology mapping (LLM-assisted)
  - requirements → conceptualization into **Component / Process / Function** individuals
  - visualize the resulting knowledge graph (small scale: ~10–20 requirements)

### Proposed seeded workbook + artifact set (planned)
Workbook id/name (proposed):
- `conceptualizer-cdd-demo` — “Conceptualizer (CDD → Requirements → Ontology)”

Artifacts:
- **Source CDD** (input):
  - Option A (preferred for determinism): `cdd/cdd_excerpt.md` (CDD excerpt in markdown)
  - Option B: `cdd/cdd.pdf` (if/when we add robust PDF ingestion; likely not required for MVP demo)
- **Requirements sheet** (canonical):
  - `requirements/requirements.is`
  - Minimum columns (proposed): `REQ_ID`, `Text`, `Type` (KPP/KSA/Constraint), `Priority`, `SourceRef`, `Notes`
- **Ontology file** (canonical):
  - `ontology/aircraft.owl` (or `.ttl`) — pick one and stay consistent
- **Individuals / instances (canonical, simple storage)**:
  - Store generated individuals in a spreadsheet for deterministic review/edit:
    - `individuals/individuals.is`
  - Minimum columns (proposed): `Individual_ID`, `Type` (Component/Process/Function), `Label`, `Description`, `SourceReqIds`, `OntologyRef`, `Notes`
- **Requirement → Ontology mapping** (derived):
  - `mappings/req_to_ontology.json`
  - Must include: `REQ_ID`, `ontology_terms`, `confidence`, `rationale`, `evidence` (source refs)
- **Concept outputs** (derived):
  - `concept/concept_summary.md` (human readable)
  - Optional: `concept/concept_graph.json` (for future visualization; not required for MVP demo)
- **Graph visualization output** (derived, demo-critical):
  - Provide a graph view of the ontology + individuals (small scale) so users can “see” the knowledge graph:
    - Option A: render from a generated `concept/concept_graph.json`
    - Option B: render directly from OWL + individuals sheet (implementation detail)

### Required extension(s) (planned)
We will likely need at least one new extension (or two decoupled ones):
- **Ontology extension** (minimal OWL support + visualization)
  - View `.owl` (raw text) and provide a **graph view** (classes/properties at minimum; individuals optional)
  - Must remain fail-soft: invalid OWL shows an explicit error state, not a broken blank view
- **Conceptualizer extension** (ReqFlow-like pipeline)
  - Extract requirements from CDD excerpt into `requirements.is`
  - Map requirements to ontology terms (LLM-assisted)
  - Generate P/F/C individuals and write them into `individuals.is`
  - Generate a graph-able representation (for visualization) and a human summary

Minimum tool surface (names TBD; intent is what matters):
- [ ] `conceptualizer.extract_requirements`
  - input: `workbook://.../cdd_excerpt.md` (or selected open doc)
  - output: `workbook://.../requirements/requirements.is`
- [ ] `ontology.map_requirements`
  - input: requirements sheet + ontology file
  - output: `workbook://.../mappings/req_to_ontology.json`
- [ ] `conceptualizer.generate_concept`
  - input: requirements + mapping (+ optional constraints)
  - output: `workbook://.../concept/concept_summary.md` (+ optional graph JSON)
- [ ] `conceptualizer.generate_individuals`
  - input: requirements + mapping (+ ontology)
  - output: `workbook://.../individuals/individuals.is`
- [ ] `ontology.render_graph` (or viewer-side feature, no tool required)
  - input: ontology (+ optional individuals)
  - output: a deterministic graph view for the demo

Fail-soft requirements:
- If ontology parsing fails, show an explicit error artifact (or error state) explaining what’s missing/invalid.
- If LLM mapping returns low confidence, store that explicitly and still produce a minimal concept output with caveats.
- Keep scale demo-friendly: target **10–20 requirements** producing on the order of **hundreds of individuals** (not millions).

### Proof (deterministic smoke)
- [ ] Load conceptualizer demo → assert workbook exists and core artifacts exist.
- [ ] Open the requirements sheet and ontology file; assert viewers mount.
- [ ] Run “extract requirements” tool (or seeded pre-run) and assert the sheet is populated.
- [ ] Run “map requirements” tool (or seeded pre-run) and assert mapping JSON exists and is non-empty.
- [ ] Open the ontology graph view and assert it renders a non-empty graph (selector-only).

---

## Explicit non‑goals (for the end‑of‑month Deloitte demos)

- Full “Requirements Workbench” UI (new core surface) — out of scope unless separately contracted.
- Full ontology editing UI — ontology can be a file with minimal tooling for the demo.
- Perfect PDF ingestion — markdown excerpt is acceptable for deterministic demoability.
- Full MDAO / sizing / optimization — concept outputs can be “first-order” narrative + traceability.
- RDF databases / triple stores (e.g., Fuseki) — out of scope for this demo; file + sheet artifacts only.

---

## Repo touch points (expected)

Demo infrastructure:
- `electron/services/demoService.ts` (add demo id + load behavior)
- `electron/services/demoSeedService.ts` (seed conceptualizer demo workbook + any new artifacts)
- `tests/automation-smoke-ui.mjs` (add demo3 assertions; extend demo proofs)

Extensions / MCP:
- New extension folder(s) under `src/extensions/...` and potentially new MCP server(s) under `mcp-servers/...`
- Central testIds: `src/testing/testIds.ts` (selectors for any new UI actions required by demo3)

Docs:
- This contract: `docs/Contracts/Demos_Deloitte_EndOfMonth.md`
- Demo walkthrough docs embedded in each demo workbook (seeded content)

---

## Open questions (need user decisions before implementation)

1) **CDD input format**: For the demo, do you want to commit to **Markdown CDD excerpt** (deterministic) or require **PDF/DOCX ingestion**?
2) **Ontology format**: should the ontology be **OWL**, **Turtle**, or a simpler JSON taxonomy for the demo?
3) **Mapping target**: confirm the decomposition we should demonstrate:
   - Process / Function / Component (P/F/C), or
   - Capability / Activity / System, or
   - another schema you want Deloitte to see.
4) **Where requirements live**: confirm “Requirements in an Insight Sheet” is the intended primary artifact (vs markdown table).
5) **Concept output expectations**: what is the minimal credible concept artifact?
   - a component breakdown + rationale,
   - a notional aircraft configuration summary,
   - and/or a requirements-to-architecture trace matrix.
