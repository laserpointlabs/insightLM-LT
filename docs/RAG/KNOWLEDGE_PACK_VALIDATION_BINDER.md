# Knowledge Pack Validation Binder (FEA-Style “Golden Problems”)

## Purpose

Engineers don’t trust “smart tools” unless they are validated against known problems with known answers.
This document defines a **Knowledge Pack Validation Binder** approach for insightLM-LT: a repeatable, testable way to curate domain knowledge (trade studies, aircraft acquisition, cost models, reliability, FEA/CFD, etc.) and prove it behaves correctly against **ground-truth scenarios**.

The core idea is the same as classic **FEA validation binders** (e.g., “10 binders of tested FEA problems”):

- We define a set of **canonical problems** we already understand.
- We define **oracles** (expected answers, properties, citations) for each problem.
- We run deterministic tests against every release of the pack and we do not ship if it fails.

This turns a “knowledge pack” into a **versioned product** with **measurable quality**.

## Why this matters (and why “RAG later” is fine)

You do not need a full vector RAG pipeline to start validating packs.

You can start with:

- deterministic keyword search + metadata filters
- “verified questions” lists (like `docs/Extensions/Dashboard/VERIFIED_DASHBOARD_QUESTIONS.md`)
- a strict requirement that answers include **traceable citations** to approved sources/templates

As retrieval improves (hybrid search, embeddings, rerankers), the **binder stays the same** and becomes your regression suite.

## Definitions

- **Knowledge Pack**: A versioned bundle of curated sources + templates + guidance intended to support a domain workflow (e.g., trade studies).
- **Binder**: The validation suite for a pack: scenarios, oracles, and test runs.
- **Scenario**: A realistic user problem statement (or task) with context and constraints.
- **Oracle**: The expected output, expressed as **checkable requirements** (structure, numbers, key points, citations, absence of disallowed claims).
- **Provenance**: The source trail for every claim (doc ID + section/page + version).

## Binder structure (recommended)

Each knowledge pack release should include a binder with:

### 1) Scope + applicability

- What the pack **covers**
- What it **does not cover**
- Intended users and decision context (pre-MDD, source selection, preliminary design, etc.)
- “Source precedence” policy (what wins when sources conflict)

### 2) Canonical scenario set (“golden problems”)

Scenarios should be selected to represent:

- typical usage (happy path)
- boundary conditions (missing data, unit mismatch, conflicting sources, uncertainty)
- known failure modes (“things people mess up in real life”)

Each scenario should include:

- problem statement (what the user asks)
- required inputs and assumptions
- allowed tools/actions (e.g., “must use template X”, “must show sensitivity analysis”)
- expected output format (structure)

### 3) Oracles (what “correct” means)

Avoid “the answer sounds right” grading.

Prefer checkable requirements:

- **Structure**: required sections present (e.g., Decision Criteria, Assumptions, Normalization, Sensitivity, Recommendation)
- **Citations**: required sources cited for certain claims (and disallow uncited claims)
- **Numbers/constraints**: deterministic checks where possible (e.g., “weights sum to 1.0”, “score normalization rule matches template”)
- **Forbidden content**: ban claims that are out-of-scope or unsafe (e.g., “guarantees flightworthiness”, “states material allowables without citing the authoritative source”)

### 4) Test execution + reporting

Every pack release should record:

- the exact pack version (and hashes of sources, if applicable)
- the toolchain version (app, MCP server, retrieval algorithm)
- the test run results:
  - pass/fail per scenario
  - failure diff: what changed, which citation missing, which requirement violated

## Three levels of validation (recommended)

### Level A: Content integrity (static)

Checks that require no LLM:

- manifest/schema validation (required metadata exists)
- source provenance completeness (license fields, version/date)
- broken links / missing files
- template “golden files” unchanged unless intentionally updated

### Level B: Retrieval tests (deterministic)

Given a query, verify the system reliably returns the right sources/snippets/templates.

Example checks:

- top N results must contain specific snippet IDs
- filters behave correctly (domain, authority level, lifecycle phase)
- “no results” behavior is correct and helpful

### Level C: Answer tests (LLM-in-the-loop)

Given a scenario, verify the produced answer:

- includes required sections
- includes required citations
- does not include forbidden claims
- includes required computations where applicable (e.g., sensitivity analysis)

Important: You can keep these tests stable by grading on **structure + citations + explicit invariants**, not on prose quality.

## How this maps to the product you want to build/sell

This binder is the thing that makes the pack defensible:

- “Pack v1.0 ships with 35 validated scenarios”
- “Every claim is traceable to source X, section Y”
- “Regression suite prevents quality drift”

It also creates a clean pricing model:

- Base pack includes binder + templates
- Premium includes expanded scenario coverage, customer-specific scenarios, and periodic re-validation

## Demo-ready v0 (simple, credible, and fast)

For a demo, a binder does not need to be huge. It needs to be **real**.

### Suggested v0 pack: Trade Studies

Include:

- a decision matrix template
- a normalization rule (documented)
- a weighting policy (documented)
- a sensitivity analysis checklist
- an example completed trade study (the “golden output”)

### v0 binder scenarios (3 scenarios is enough)

1) **Baseline trade study (happy path)**
   - Compare 3 concepts, 5 criteria, with weights.
   - **Oracle**: weights sum to 1.0; normalization method described; final ranking consistent with example; cites template + guidance doc.

2) **Missing data + uncertainty**
   - One concept missing a criterion score.
   - **Oracle**: answer explicitly calls out missing data; uses documented policy (e.g., penalize/estimate/omit) with citation; includes sensitivity note.

3) **Conflicting sources**
   - Two sources recommend different weighting heuristics.
   - **Oracle**: applies precedence policy; documents decision; cites both sources and explains why one is authoritative for this organization.

### What to show live in the demo

- The pack has a version (e.g., `trade-studies-pack@0.1.0`)
- The binder lists scenarios and “PASS” results
- A user asks one of the scenario questions in-app and the response includes:
  - the required structure
  - citations back to the pack’s sources/templates

## Implementation notes (future-facing, but compatible with today)

The binder should remain stable while retrieval evolves:

- Today: keyword search + curated templates
- Next: hybrid (keyword + embeddings)
- Later: reranking and richer chunking

The binder becomes your non-negotiable regression suite across those steps.

## Related documentation in this repo

- `docs/Extensions/Dashboard/VERIFIED_DASHBOARD_QUESTIONS.md` (pattern: verified prompts with known correct outputs)
- `docs/RAG/RAG_CONTENT_SEARCH_TEST_RESULTS.md` (pattern: tested retrieval behavior and robustness)
- `docs/Testing/TESTING.md` (how we run deterministic UI automation and test workflows)

