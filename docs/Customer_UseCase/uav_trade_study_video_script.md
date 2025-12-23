## UAV Trade Study Video Script (InsightLM‑LT)

This script is designed to clearly demonstrate:
- **SCOPED context is active** (Chat/RAG/Dashboards operate on the active context)
- **Canonical model lives in the Insight Sheet** (`.is`)
- **Notebook produces derived artifacts** (`results/summary.json`, `results/study_report.md`)
- **Chat writes the recommendation memo** grounded in the scoped workbook artifacts
- **Dashboard summarizes results** and stays consistent after iteration

Assumes the seeded demo workbook exists:
- Workbook: **UAV Trade Study (Disaster Response)** (`uav-trade-study`)

---

## Pre-flight checklist (10–20s)

- Confirm the UI shows:
  - **`Scope: UAV Trade Study`**
  - **`SCOPED`** (not `ALL`)
- Optional: expand **Contexts** and point to the `SCOPED/ALL` toggle.

Suggested narration:
> “Notice we’re in **SCOPED** mode and the active scope is **UAV Trade Study**. That means the assistant and dashboards are grounded on this workbook’s content.”

---

## Step 1 — Reset derived outputs (10–20s)

Open these files in the UAV workbook:
- `trade/results/summary.json`
- `trade/results/study_report.md`

Reset them (pick one approach):
- **Option A (simple)**: clear contents and **Save**
- **Option B (stronger demo)**: delete the files (if your UI supports delete), then recreate via notebook run

Suggested narration:
> “These are **derived artifacts**. The sheet is the source of truth; the notebook regenerates results.”

---

## Step 2 — Show the canonical model (45–60s)

Open: `trade/decision_matrix.is`

Show these tabs:
- **Decision Matrix**
  - Point at criteria, weights, and the **TOTAL / Normalized** row.
- **COIC & Measures**
  - Point at COIs → COIC criteria → measures + threshold/objective.
- **Alternatives**
  - Point at the specs table (range/endurance/payload/etc).

Make a small edit (optional, but good):
- tweak one weight (e.g., Cost up slightly) or one score
- **Save**

Suggested narration:
> “This sheet is the canonical object model: the IDs/fields here are truth. It’s built so stakeholders can review the assumptions without digging into code.”

---

## Step 3 — Run the analysis notebook (30–45s)

Open: `trade/trade_study.ipynb`

Run the first code cell.

Then open and briefly show:
- `trade/results/summary.json` (ranked alternatives + sensitivity section)
- `trade/results/study_report.md` (human-friendly ranked list + sensitivity + next steps)

Suggested narration:
> “The notebook reads the canonical sheet and writes derived outputs. This is our ‘analysis lane’.”

---

## Step 4 — Prove “context is active” in Chat (45–90s)

Open **Chat** while the UI still shows **Scope: UAV Trade Study** and **SCOPED**.

Suggested narration:
> “Because we’re scoped, the assistant is grounded only on this workbook’s artifacts.”

### Prompt A — Generate the recommendation memo (paste in Chat)

Using `workbook://uav-trade-study/documents/trade/results/summary.json` and `workbook://uav-trade-study/documents/trade/results/study_report.md`, write a decision memo and save it to `workbook://uav-trade-study/documents/trade/recommendation.md`.

Include:
1. Recommendation
2. Ranked shortlist (top 3)
3. Sensitivity / robustness notes
4. Risks + assumptions
5. Next-step analysis plan (DOE/UQ, feasibility, driver ID/Sobol, Pareto)

Then open: `trade/recommendation.md`

Suggested narration:
> “This memo is generated from the **scoped** workbook context, grounded in the results we just produced.”

---

## Step 5 — Show the dashboard (20–40s)

Open **Dashboards** and select:
- **UAV Trade Study Dashboard**

If needed, refresh tiles so they render.

Suggested narration:
> “The dashboard reads the same results artifacts. This is how you brief leadership quickly while keeping traceability back to the sheet and analysis.”

---

## Step 6 — Iterate (change the decision, re-run, re-brief) (60–120s)

1. Open `trade/decision_matrix.is`
2. Make a change that should affect ranking (examples):
   - Increase **Cost** weight significantly
   - Decrease **Endurance** weight
   - Adjust a few key scores on the top contender(s)
3. **Save**
4. Re-run the first notebook code cell in `trade/trade_study.ipynb`
5. Open `trade/results/study_report.md` and show the new ordering
6. Return to **Dashboard** and show tiles reflect the new results

### Prompt B — Update the memo + add a “What changed” section (paste in Chat)

Re-read `workbook://uav-trade-study/documents/trade/results/summary.json` and update `workbook://uav-trade-study/documents/trade/recommendation.md` to reflect the new results.

At the top, add a **What changed** section summarizing:
- what changed in ranking/recommendation
- which criteria/weights drove the change (use the sensitivity results)
- any updated risks/assumptions

Suggested narration:
> “This is the value: we can adjust assumptions in the canonical sheet, re-run analysis, and regenerate the briefing materials—still scoped to the active context.”

---

## Closing one-liner (repeatable)

> “**Sheet = truth**, **Notebook = analysis**, **Results = derived**, **Chat + Dashboard = communication**, and **SCOPED context** keeps everything grounded to this workbook.”
