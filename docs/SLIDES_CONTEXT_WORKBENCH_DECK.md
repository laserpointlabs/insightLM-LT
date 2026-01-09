## INSIGHT‑LM — Context Management Workbench (Concise Deck)

Insight‑LM is a **Context Management Workbench**: a single canvas that keeps the working context of what you’re doing—notes, files, conversations, and artifacts—so you can **build, revisit, and audit** work over time.

This is the natural progression from **prompt engineering** to **context management**. Prompts are a thin interface to what you *meant*; complex work needs the full set of inputs, assumptions, intermediate artifacts, and decisions captured over time. You start with a clean work surface, then attach capability when you need it—like apps inside the workbench.

- **Canvas**: one place to work, where the current problem’s context is visible and organized.
- **Context management**: capture → structure → retrieve → trace (so outputs are explainable later).
- **Extensibility**: add “apps” as extensions (examples: conceptualizer, ontology development, notebooks/sheets, scrapers/connectors).
- **Scope control**: you decide what’s “in play” for a task (so results stay grounded and reviewable).

---

## Example — The “context gap” we’re closing

If you’re a PhD student (or an engineer/PM/scientist) juggling dozens of sources, notes, and drafts, the hardest part is the **gap** where external context has to pass through your head and hands and gets dropped. The workbench is meant to keep that context **continuously connected** to the work as you read, extract, and build.

People sometimes ask, “Isn’t this just RAG?” We may **use retrieval (including RAG-style retrieval)**, but that’s not the product. The product is a **context management system**: a baseline canvas that holds the active working set, plus extensions you can plug in to do specific jobs. When an extension is on, it operates **in the context** and its inputs/outputs become part of what you can trace, reuse, and scope.

Workbenches follow the same rule. As the **Data Workbench** comes online, data you pull in will become part of the active context (and whatever scoped context boundary you choose), so downstream tools and views can operate on it without “dropping the ball” between systems.

---

## History — Evolution to Current State

This started in early 2024 while evaluating LLMs and learning the APIs. The key realization was that for complex work (like requirements), you can’t just “ask questions” and hope the model keeps everything straight. You need a **structured intermediary**—an ontology as a Rosetta stone—so you can turn unstructured source documents (CDD/ICD) into structured estimates of what a system needs (components, processes, functions, interfaces) and how those pieces relate.

- **RecFlow (early 2024)**: extract requirements (CDD/ICD) → map them through a basic SE ontology → use an LLM for structured estimation → represent the results as a graph.
- **ODRAS**: attempted to generalize by “crowbarring” semantic models and ontology tooling into the UI. It worked for pockets of ontology work, but there was no true context core (no shared semantic model/canvas), so tool outputs didn’t reliably feed back into what the LLM could see and build on.
- **InsightLM‑LT (current)**: a context management workbench that holds the working set and lets you plug in extensions (analysis, notebooks/sheets, conceptualizer/ontology, etc.).

---

## Functional Block Diagram (Core vs Extensions)

This is the simplest way to read the system: **you work on a canvas**, and everything you do produces artifacts (notes, files, chats, sheets, notebooks). Those artifacts become the working set for the next step, so you can keep building without losing track of what you used or why.

The “core” is the part that makes that loop stable: it stores the working set, lets you retrieve it quickly, and keeps enough trace that you can revisit and audit outputs. “Extensions” are optional tools that operate on the same working set and write their outputs back into it (instead of creating disconnected one-off results).

- **Canvas / Workbench UI**: where you create and organize the working set (tabs, views, workbooks, files).
- **Chat (authoring)**: one way to generate/refine artifacts and decisions.
- **Context store + retrieval**: where the working set lives and how you pull it back into focus.
- **Trace/audit**: what lets you understand “what did we use?” and “why do we believe this?”
- **Extensions**: add new capabilities (analysis, notebooks/sheets, conceptualizer/ontology, connectors) that read/write the same working set.

---

## Architecture — diagram notes (replace with a real graphic)

This slide should be a **simple box-and-arrow diagram** (PowerPoint graphic) that shows how work moves through the system. The goal is for someone to understand, in 10 seconds, what “core vs extensions” means and where context lives.

- **Left**: inputs (imports/subscriptions) and user actions.
- **Center**: the **workbench canvas** + **context store** (the working set) + **retrieval/views** + **trace**.
- **Right**: extensions/workbenches as optional tools that read/write the same working set and produce new artifacts.
- **Bottom**: outputs (published artifacts, notifications).

One key callout: **Scope** controls what’s “in play” for retrieval and tool actions (so work stays grounded and reviewable).

---

---

## Baseline Analysis (today) — Sheets + Notebooks

- **Sheets (Excel-like)**: “light” analysis for generalists (everyone already knows the workflow)
- **Notebooks (Jupyter)**: “heavy” analysis for engineers/data scientists (code + results)
- **Both are extensions**: enable/disable, but they’re baseline capabilities now
- **Universal on-ramp**: familiar tools that pull people into the context workflow immediately
- **Lessons learned**: users don’t adopt “power” first → they adopt familiar tools (Excel). We added sheets fast (<2h) by building an Excel-like extension.
- **Covers most work**: likely ~70% of real-world use cases (generalists: PMs, supply chain, teachers, policy, analysts) before any domain-specific extensions
- **Critical point**: sheet contents **and formulas** are captured as context → inspect, trace, and flow results to dashboards/publish
- **Interop**: notebook → sheet → dashboard → published artifact (and reports/papers/diagrams) — all stays in-context

---

## Future (Idea) — Upstream/Downstream + Lattice

- **Multiple seats**: your desktop subscribes to upstream artifacts (and publishes downstream)
- **Change notifications**: “upstream loads changed” → evaluate impact before accepting/releasing
- **Impact tracking**: dashboards monitor MOS / modes / stress/strain over time (not one‑off results)
- **Process workbench**: release/review workflows for documents, models, and published artifacts
- **Program lattice** (ODRAS idea): upstream/downstream relationships can be auto‑generated; users “join” a node
- **Program Workbench**: uses ontology + program requirements to **bootstrap a lattice of projects** + auto-wire pub/sub so work starts in parallel

---

## Two Levels of Use (same tool, different scale)

- **Level 1**: a user works inside one project context (data/events/decisions) with optional extensions
- **Level 2**: **Program Workbench** bootstraps many project contexts + their pub/sub links (the lattice)

## Example — Ontology Work in Context (Knowledge Packs)

- **User intent**: “Help me build an ontology to answer these competency questions”
- **Delivery**: ontology capability is **not core**; it will ship as **an Ontology Workbench or an Ontology Extension** (one or the other)
- **How the LLM knows how**: **Knowledge Packs** (starter ontologies + patterns + examples)
  - **Non‑experts** start from a pack; **experts** extend/replace it
- **What’s captured as context**: ontology drafts, the chat rationale, requirements, outputs, and revisions (traceable)
- **What it enables**: map requirements → components → processes → functions → interfaces (iterate until stable; compare high/low confidence)
- **Same pattern for SysML**: define competency questions → define/choose ontology (semantics) → build or map SysML so the model can answer questions (not just be pictures) + keep full provenance with the context
  - **Traceable loop**: requirements → ontology → concepts/definitions → SysML model definitions → system model; ontology also acts as a **Rosetta Stone** to translate new requirements/entities into the same namespace

---

## Use Cases (Live)

- **UC1 — AC‑1000 (live)**: load AC‑1000 artifacts into the working context → ask questions → do lightweight analysis → publish a few dashboard tiles
- **UC2 — Trade study (live)**: machine generates a **sheet + notebook** from the prompt → iterate → capture outputs back into the working context
- **UC3 — Requirements workflow (live)**:
  - Provide a fake **CDD** → extract requirements (extension) → store as a sheet/table (+ notes)
  - Build a simple SE ontology (Requirement/Component/Process/Function/Interface) (pack‑seeded)
  - Conceptualize each requirement against the ontology (extension) → write results to sheets → ask questions → pin key outcomes to dashboards

---

## Conclusion

Insight‑LM is a **Context Management Workbench**: a canvas that keeps the working set connected (documents, notes, chat, and artifacts) so complex work doesn’t fall into the “context gap.” It’s not “just RAG”—retrieval can help, but the core value is that the workbench makes context **persistent, scoped, and reusable**.

When you add capabilities, they don’t create disconnected outputs. Extensions operate on the same working set and write results back as artifacts you can revisit, share, and audit. That’s what makes this useful for real delivery work: fewer one-off chats, more durable outputs, and a clearer chain from source material to conclusions.

---

## Appendix — Potential Extensions (examples)

Extensions are how the workbench grows without bloating the core. They’re optional “capability plug‑ins” that read from the active context, do a focused job, and write outputs back as new artifacts (files, tables, dashboards, notes).

- **Ingestion + connectors**: web scraper, SharePoint/Confluence connector, Git/GitHub connector, email/Teams/Slack connector, SQL/Postgres connector, REST/API connector.
- **Parsing + extraction**: PDF/DOCX table extractor, requirements extractor (CDD/ICD), citation manager, OCR + figure extraction.
- **Analysis + compute**: calculation engine, trade-study / MCDA, simulation runner, unit conversion + sanity checks, notebook execution, spreadsheet authoring.
- **Modeling + engineering**: ontology builder, conceptualizer, SysML tooling, interface dictionary, test/verification tracer.
- **Decisioning + quality**: evidence checker, contradiction detector, risk register generator, margin-of-safety tracker, provenance/trace packager.
- **Automation + workflows**: process/workflow runner, scheduled refresh jobs, “pipeline” extensions (ingest → analyze → publish).
- **Publishing**: report/whitepaper generator, slide generator, dashboard tile generator, outbound publish + notifications.

---

## Appendix — Retrieval Strategy (Why file-based)

- **What we use now**: file-based retrieval (fast search + grep; scoped to the active context)
- **Why**: simple, deterministic, easy to trust/trace, strong “one-shot” accuracy in practice
- **Why not “classic vector-store RAG” (yet)**: indexing + reranking can get messy on complex questions and can degrade trust

---

## Appendix — Retrieval (Future experiments, not commitments)

- **Improve current path**: richer file retrieval, better chunking, better grep patterns, tighter scoping
- **Auto‑RAG (as an MCP server)**: LLM generates and runs multiple **lexical/file retrieval** calls (query rewrites, scoped searches, iterative narrowing)
- **Corrective / self-check loops**: draft → verify grounding → retrieve missing evidence → revise (can use teaming + convergence criteria)
- **Possible “new RAG”**: live / in-memory indexing (vs heavy persistent vector pipelines)
- **Evaluation**: uncertainty / multi-shot studies and latency tradeoffs; adopt only if it measurably beats lexical on hard queries
- **Generated “ephemeral tools”**: generate the code needed for a task at run-time (script or short-lived server), execute in a bounded sandbox, then shut down — capability arises as needed, trace stays with the context


---

## Appendix — Teaming (what it is)

- **Definition**: “Teaming” = **multiple independent passes** (people and/or agents) collaborating on the same objective with explicit roles and checkpoints
- **Typical roles** (can be humans, LLMs, or mixed):
  - **Planner**: decomposes the task and sets success criteria
  - **Proposer**: drafts the solution
  - **Critic**: stress-tests assumptions and finds failure modes
  - **Verifier**: checks grounding (sources/trace), calculations, and consistency
- **Output is not just an answer**: it’s a **traceable rationale** + supporting artifacts (notes, sheets, notebooks, links) captured as context

---

## Appendix — Why we use teaming (instead of single-shot Q&A)

- **Complex problems aren’t one question**: they are a chain of sub-questions, assumptions, and tradeoffs; single-shot answers hide that structure
- **Reliability comes from redundancy**: independent passes catch different errors (omissions, wrong assumptions, misreads, math slips)
- **We can make the *process* deterministic**: define “done” as passing explicit gates (evidence present, constraints satisfied, contradictions resolved)
- **We get measurable quality**: teaming enables **batting average** tracking (how often answers survive verification) instead of vague “it seems right”

---

## Appendix — “Hallucination” is just probability (how we frame it)

- **Better language**: call it **error rate under uncertainty**, not “hallucination” (anthropomorphic and unhelpful)
- **Key point**: any model output is a **probabilistic guess**; the only question is how we **reduce the probability of being wrong**
- **What reduces error**:
  - **Grounding**: retrieve/quote the actual artifacts (files/data) used to answer
  - **Verification**: cross-check claims, numbers, and constraints with a separate pass
  - **Convergence criteria**: don’t ship an answer until checks pass (or mark it “unknown”)
- **What we avoid**: treating the first fluent answer as truth; for hard problems we require **teaming + checks**

---

## Appendix — Teaming workflow inside the Context Workbench (practical)

- **Step 1 — Scope**: define the question + constraints + what counts as evidence (Context Scope)
- **Step 2 — Collect**: pull relevant artifacts into the working context (notes, files, sheets, notebooks)
- **Step 3 — Team passes**: proposer/critic/verifier runs (humans and/or agents) with written checkpoints
- **Step 4 — Converge**: resolve disagreements explicitly; if unresolved, record “unknown” and what would settle it
- **Step 5 — Publish**: ship outputs with trace (what we used, why we believe it, and where it might fail)

---


## Appendix — Notes (1/7/26)

- Describe sandbox in APPDIR
  - What it is, what it does, scalable, secure, etc.
- Expert system: over time this grows into a full expert system
- Avian may pursue its own sales model