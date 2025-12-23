import * as fs from "fs";
import * as path from "path";

type SeedOpts = {
  /**
   * If true, will skip seeding even on first run. Useful for dev/debug.
   */
  disabled?: boolean;
  /**
   * Override seed source dir (where trade_study_example markdown lives in packaged builds).
   */
  seedSourceDir?: string;
};

type WorkbookDoc = {
  filename: string;
  /** Relative path under workbook, e.g. `documents/foo.md` or `documents/trade/foo.md` */
  relPath: string;
  content: string;
  addedAt?: string;
};

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeFileEnsuringDir(absPath: string, content: string) {
  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, content, "utf-8");
}

function readIfExists(absPath: string): string | null {
  try {
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, "utf-8");
  } catch {
    return null;
  }
}

function listDirs(p: string): string[] {
  try {
    if (!fs.existsSync(p)) return [];
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function createWorkbookOnDisk(
  workbooksDir: string,
  workbookId: string,
  name: string,
  folders: string[],
  documents: WorkbookDoc[],
) {
  const wbPath = path.join(workbooksDir, workbookId);
  const docsRoot = path.join(wbPath, "documents");

  ensureDir(docsRoot);
  for (const f of folders) {
    const folderName = String(f || "").trim();
    if (!folderName) continue;
    ensureDir(path.join(docsRoot, folderName));
  }

  const now = new Date().toISOString();
  const workbook = {
    id: workbookId,
    name,
    created: now,
    updated: now,
    archived: false,
    folders: folders,
    documents: [] as Array<{
      filename: string;
      path: string;
      addedAt: string;
    }>,
  };

  for (const doc of documents) {
    const rel = doc.relPath.replace(/\\/g, "/").replace(/^\.\//, "");
    const abs = path.join(wbPath, ...rel.split("/"));
    writeFileEnsuringDir(abs, doc.content);

    workbook.documents.push({
      filename: doc.filename,
      path: rel,
      addedAt: doc.addedAt || now,
    });
  }

  fs.writeFileSync(path.join(wbPath, "workbook.json"), JSON.stringify(workbook, null, 2), "utf-8");
}

function computeScore1to5(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 3;
  if (max <= min) return 3;
  const t = (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.max(1, Math.min(5, Math.round(1 + clamped * 4)));
}

function createUavDecisionMatrixSheet(workbookId: string) {
  // Alternatives from `data/trade_study_example/uas_specifications.md`
  // We score only criteria we can infer deterministically from the spec sheet and keep others baseline=3.
  const alts = [
    { name: "SkyEagle X500", rangeKm: 150, enduranceHr: 9, payloadKg: 3.5, weatherKnots: 25, costM: 1.2, linkKm: 150 },
    { name: "WingOne Pro", rangeKm: 75, enduranceHr: 5, payloadKg: 1.8, weatherKnots: 15, costM: 0.45, linkKm: 75 },
    { name: "AeroMapper X8", rangeKm: 200, enduranceHr: 13, payloadKg: 5, weatherKnots: 35, costM: 1.7, linkKm: 200 },
    { name: "QuadCopter T4", rangeKm: 8, enduranceHr: 0.66, payloadKg: 0.8, weatherKnots: 15, costM: 0.12, linkKm: 8 },
    { name: "HexaCopter H6 Heavy", rangeKm: 15, enduranceHr: 0.9, payloadKg: 4, weatherKnots: 25, costM: 0.45, linkKm: 15 },
    { name: "OctoCopter Sentinel", rangeKm: 25, enduranceHr: 1.15, payloadKg: 8, weatherKnots: 35, costM: 0.8, linkKm: 25 },
    { name: "Falcon VTOL-X", rangeKm: 100, enduranceHr: 5.5, payloadKg: 2.5, weatherKnots: 25, costM: 0.85, linkKm: 100 },
    { name: "HoverCruise 700", rangeKm: 120, enduranceHr: 7.5, payloadKg: 3.5, weatherKnots: 25, costM: 0.98, linkKm: 120 },
    { name: "TriVector VTOL", rangeKm: 180, enduranceHr: 9.5, payloadKg: 7, weatherKnots: 35, costM: 1.5, linkKm: 180 },
  ];

  const ranges = alts.map((a) => a.rangeKm);
  const ends = alts.map((a) => a.enduranceHr);
  const pays = alts.map((a) => a.payloadKg);
  const winds = alts.map((a) => a.weatherKnots);
  const costs = alts.map((a) => a.costM);
  const links = alts.map((a) => a.linkKm);

  const minMax = (xs: number[]) => ({ min: Math.min(...xs), max: Math.max(...xs) });
  const r = minMax(ranges);
  const e = minMax(ends);
  const p = minMax(pays);
  const w = minMax(winds);
  const c = minMax(costs);
  const l = minMax(links);

  // Criteria list mirrors `data/trade_study_example/decision_matrix_template.md`
  // Weights are “starter defaults” (editable by user).
  const criteria = [
    { name: "Operational Range", weight: 8 },
    { name: "Endurance", weight: 9 },
    { name: "Payload Capacity", weight: 7 },
    { name: "Environmental Tolerance", weight: 8 },
    { name: "Deployment Speed", weight: 9 },
    { name: "Image Quality", weight: 7 },
    { name: "Data Transmission", weight: 6 },
    { name: "Cost", weight: 5 },
    { name: "Regulatory Compliance", weight: 10 },
    { name: "Ease of Operation", weight: 6 },
  ];

  // Build a 2D table in an `.is` sheet using A1-style cell keys.
  // Columns:
  // A: Criterion, B: Weight, C..: Alternatives
  const cells: Record<string, any> = {};

  // Header row
  cells["A1"] = { value: "Criterion" };
  cells["B1"] = { value: "Weight" };
  alts.forEach((a, idx) => {
    const col = String.fromCharCode("C".charCodeAt(0) + idx);
    cells[`${col}1`] = { value: a.name };
  });

  // Criteria rows
  criteria.forEach((cRow, i) => {
    const row = i + 2;
    cells[`A${row}`] = { value: cRow.name };
    cells[`B${row}`] = { value: cRow.weight };
  });

  // Scores by criterion (starter heuristics)
  const scoreByCriterion = (criterionName: string, alt: (typeof alts)[number]): number => {
    switch (criterionName) {
      case "Operational Range":
        return computeScore1to5(alt.rangeKm, r.min, r.max);
      case "Endurance":
        return computeScore1to5(alt.enduranceHr, e.min, e.max);
      case "Payload Capacity":
        return computeScore1to5(alt.payloadKg, p.min, p.max);
      case "Environmental Tolerance":
        return computeScore1to5(alt.weatherKnots, w.min, w.max);
      case "Data Transmission":
        return computeScore1to5(alt.linkKm, l.min, l.max);
      case "Cost":
        // Lower cost is better → invert
        return computeScore1to5(c.max - alt.costM, 0, c.max - c.min);
      default:
        return 3;
    }
  };

  criteria.forEach((cRow, i) => {
    const row = i + 2;
    alts.forEach((alt, idx) => {
      const col = String.fromCharCode("C".charCodeAt(0) + idx);
      cells[`${col}${row}`] = { value: scoreByCriterion(cRow.name, alt) };
    });
  });

  // Totals row with SUMPRODUCT formulas
  const totalRow = criteria.length + 2;
  cells[`A${totalRow}`] = { value: "TOTAL (weighted)" };
  cells[`B${totalRow}`] = { value: "" };

  const weightsRange = `$B$2:$B$${criteria.length + 1}`;
  alts.forEach((alt, idx) => {
    const col = String.fromCharCode("C".charCodeAt(0) + idx);
    const scoresRange = `${col}2:${col}${criteria.length + 1}`;
    cells[`${col}${totalRow}`] = {
      value: {
        v: null,
        f: `=SUMPRODUCT(${weightsRange},${scoresRange})`,
        m: null,
        ct: { fa: "General", t: "n" },
      },
    };
  });

  // Normalized row (0-100)
  const normRow = totalRow + 1;
  const maxPossible = criteria.reduce((s, c) => s + c.weight * 5, 0);
  cells[`A${normRow}`] = { value: "Normalized (0-100)" };
  cells[`B${normRow}`] = { value: "" };
  alts.forEach((_, idx) => {
    const col = String.fromCharCode("C".charCodeAt(0) + idx);
    cells[`${col}${normRow}`] = {
      value: {
        v: null,
        f: `=ROUND(${col}${totalRow}/${maxPossible}*100,1)`,
        m: null,
        ct: { fa: "General", t: "n" },
      },
    };
  });

  const decisionMatrix = {
    version: "1.0",
    metadata: {
      name: "UAV Decision Matrix",
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      workbook_id: workbookId,
    },
    sheets: [
      {
        id: "sheet1",
        name: "Decision Matrix",
        cells,
        formats: {},
      },
      {
        id: "sheet2",
        name: "Alternatives",
        cells: (() => {
          const c2: Record<string, any> = {};
          c2["A1"] = { value: "Alternative" };
          c2["B1"] = { value: "UAS Type" };
          c2["C1"] = { value: "Range (km)" };
          c2["D1"] = { value: "Endurance (hr)" };
          c2["E1"] = { value: "Payload (kg)" };
          c2["F1"] = { value: "Weather tol (knots)" };
          c2["G1"] = { value: "Cost ($M)" };
          c2["H1"] = { value: "Data link (km)" };
          alts.forEach((a, idx) => {
            const row = idx + 2;
            c2[`A${row}`] = { value: a.name };
            // Leave type blank for user to fill (fixed-wing / multirotor / VTOL)
            c2[`B${row}`] = { value: "" };
            c2[`C${row}`] = { value: a.rangeKm };
            c2[`D${row}`] = { value: a.enduranceHr };
            c2[`E${row}`] = { value: a.payloadKg };
            c2[`F${row}`] = { value: a.weatherKnots };
            c2[`G${row}`] = { value: a.costM };
            c2[`H${row}`] = { value: a.linkKm };
          });
          return c2;
        })(),
        formats: {},
      },
      {
        id: "sheet3",
        name: "COIC & Measures",
        cells: (() => {
          const c3: Record<string, any> = {};
          c3["A1"] = { value: "ID" };
          c3["B1"] = { value: "COI (yes/no)" };
          c3["C1"] = { value: "COIC criterion (T/O)" };
          c3["D1"] = { value: "Measure" };
          c3["E1"] = { value: "Units" };
          c3["F1"] = { value: "Threshold" };
          c3["G1"] = { value: "Objective" };
          c3["H1"] = { value: "Evidence (file)" };
          c3["I1"] = { value: "Notes" };

          const rows = [
            {
              id: "COI-001",
              coi: "Can the system survey 5–10 km² within 2 hours?",
              coic: "Coverage rate [T] ≥ 2.5 km²/hour",
              measure: "Area coverage rate",
              units: "km²/hr",
              threshold: "2.5",
              objective: "5.0",
              evidence: "workbook://uav-trade-study/documents/trade/disaster_response_requirements.md",
              notes: "From Disaster Response requirements (Coverage Area Requirements).",
            },
            {
              id: "COI-002",
              coi: "Can the system operate in winds up to 25 knots?",
              coic: "Wind tolerance [T] ≥ 25 knots",
              measure: "Wind tolerance",
              units: "knots",
              threshold: "25",
              objective: "35",
              evidence: "workbook://uav-trade-study/documents/trade/disaster_response_requirements.md",
              notes: "From Environmental Conditions requirements.",
            },
            {
              id: "COI-003",
              coi: "Can the system deploy within 15 minutes on scene?",
              coic: "Deployment time [T] ≤ 15 minutes",
              measure: "Deployment time",
              units: "minutes",
              threshold: "15",
              objective: "5",
              evidence: "workbook://uav-trade-study/documents/trade/disaster_response_requirements.md",
              notes: "This is a key operational driver for disaster response; fill with SME data.",
            },
            {
              id: "COI-004",
              coi: "Can the system maintain ≥ 3 hours mission duration?",
              coic: "Flight endurance [T] ≥ 3 hours",
              measure: "Endurance",
              units: "hours",
              threshold: "3",
              objective: "6",
              evidence: "workbook://uav-trade-study/documents/trade/uas_specifications.md",
              notes: "Use spec sheet endurance; for multirotors this is typically not met.",
            },
            {
              id: "COI-005",
              coi: "Can the system provide ≥ 2kg payload capacity?",
              coic: "Payload capacity [T] ≥ 2 kg",
              measure: "Payload capacity",
              units: "kg",
              threshold: "2",
              objective: "5",
              evidence: "workbook://uav-trade-study/documents/trade/uas_specifications.md",
              notes: "Use spec sheet payload capacity.",
            },
            {
              id: "COI-006",
              coi: "Is acquisition cost ≤ $2M?",
              coic: "Acquisition cost [T] ≤ $2M",
              measure: "Acquisition cost",
              units: "$",
              threshold: "2000000",
              objective: "1000000",
              evidence: "workbook://uav-trade-study/documents/trade/uas_specifications.md",
              notes: "Cost is approximate; treat as uncertain later.",
            },
          ];

          rows.forEach((r2, idx) => {
            const row = idx + 2;
            c3[`A${row}`] = { value: r2.id };
            c3[`B${row}`] = { value: r2.coi };
            c3[`C${row}`] = { value: r2.coic };
            c3[`D${row}`] = { value: r2.measure };
            c3[`E${row}`] = { value: r2.units };
            c3[`F${row}`] = { value: r2.threshold };
            c3[`G${row}`] = { value: r2.objective };
            c3[`H${row}`] = { value: r2.evidence };
            c3[`I${row}`] = { value: r2.notes };
          });

          return c3;
        })(),
        formats: {},
      },
    ],
  };

  return decisionMatrix;
}

function createUavNotebook(): any {
  const cells = [
    {
      cell_type: "markdown",
      source:
        "# UAV Trade Study (in-app)\n\nThis notebook is part of the seeded **UAV Trade Study (Disaster Response)** demo workbook.\n\n- Canonical inputs live in the Insight Sheet (`trade/decision_matrix.is`)\n- This notebook is intended for heavier analysis (DOE/UQ, sensitivity, feasibility)\n\n> Tip: Start by opening the sheet, adjusting weights/scores, then come back here to run sensitivity experiments.",
      metadata: {},
    },
    {
      cell_type: "code",
      source: [
        "import json, os, string",
        "from pathlib import Path",
        "from datetime import datetime, timezone",
        "",
        "WORKBOOK_ID = 'uav-trade-study'",
        "REL_SHEET = f'workbooks/{WORKBOOK_ID}/documents/trade/decision_matrix.is'",
        "REL_OUT_DIR = f'workbooks/{WORKBOOK_ID}/documents/trade/results'",
        "",
        "DATA_DIR = os.environ.get('INSIGHTLM_DATA_DIR')",
        "if not DATA_DIR:",
        "    raise RuntimeError('INSIGHTLM_DATA_DIR is not set; cannot locate workbook storage')",
        "",
        "sheet_path = Path(DATA_DIR) / REL_SHEET",
        "out_dir = Path(DATA_DIR) / REL_OUT_DIR",
        "out_dir.mkdir(parents=True, exist_ok=True)",
        "",
        "raw = json.loads(sheet_path.read_text(encoding='utf-8'))",
        "",
        "# ---- Extract decision matrix (canonical) ----",
        "mat = next((s for s in raw.get('sheets', []) if s.get('name') == 'Decision Matrix'), None)",
        "if not mat:",
        "    raise RuntimeError('Decision Matrix sheet not found')",
        "",
        "cells = mat.get('cells', {})",
        "",
        "def cell_value(addr: str):",
        "    v = cells.get(addr, {}).get('value')",
        "    if isinstance(v, dict) and 'v' in v:",
        "        return v.get('v')",
        "    return v",
        "",
        "# Alternatives from header row (row 1, starting at col C)",
        "cols = list(string.ascii_uppercase)",
        "alt_cols = cols[cols.index('C'):cols.index('C')+20]",
        "alternatives = []",
        "for col in alt_cols:",
        "    name = cell_value(f'{col}1')",
        "    if not name:",
        "        break",
        "    alternatives.append((col, str(name)))",
        "",
        "criteria = []",
        "row = 2",
        "while True:",
        "    crit = cell_value(f'A{row}')",
        "    w = cell_value(f'B{row}')",
        "    if not crit:",
        "        break",
        "    try:",
        "        w_num = float(w)",
        "    except Exception:",
        "        w_num = None",
        "    criteria.append((row, str(crit), w_num))",
        "    row += 1",
        "",
        "if not alternatives:",
        "    raise RuntimeError('No alternatives found in header')",
        "if not criteria:",
        "    raise RuntimeError('No criteria rows found')",
        "",
        "# Scores table",
        "scores = {alt_name: {} for _, alt_name in alternatives}",
        "for r, crit_name, _w in criteria:",
        "    for col, alt_name in alternatives:",
        "        s = cell_value(f'{col}{r}')",
        "        try:",
        "            scores[alt_name][crit_name] = float(s)",
        "        except Exception:",
        "            scores[alt_name][crit_name] = None",
        "",
        "# ---- Compute totals and normalized scores ----",
        "max_possible = 0.0",
        "for _r, _c, w_num in criteria:",
        "    if w_num is None:",
        "        continue",
        "    max_possible += w_num * 5.0",
        "",
        "results = []",
        "for _col, alt_name in alternatives:",
        "    total = 0.0",
        "    missing = []",
        "    for _r, crit_name, w_num in criteria:",
        "        if w_num is None:",
        "            continue",
        "        s = scores[alt_name].get(crit_name)",
        "        if s is None:",
        "            missing.append(crit_name)",
        "            continue",
        "        total += w_num * s",
        "    norm = (total / max_possible * 100.0) if max_possible > 0 else 0.0",
        "    results.append({",
        "        'alternative': alt_name,",
        "        'weighted_total': round(total, 3),",
        "        'normalized': round(norm, 2),",
        "        'missing_scores': missing,",
        "    })",
        "",
        "results_sorted = sorted(results, key=lambda r: r['normalized'], reverse=True)",
        "",
        "# ---- First-order sensitivity: +/- 20% on the top-3 weights ----",
        "crit_weights = {crit_name: w for _r, crit_name, w in criteria if w is not None}",
        "by_weight = sorted(crit_weights.items(), key=lambda kv: kv[1], reverse=True)",
        "top3 = [k for k, _ in by_weight[:3]]",
        "",
        "scenarios = []",
        "for crit_name in top3:",
        "    for factor in [0.8, 1.2]:",
        "        w2 = dict(crit_weights)",
        "        w2[crit_name] = w2[crit_name] * factor",
        "        max2 = sum(w2[c] * 5.0 for c in w2)",
        "        rows = []",
        "        for _col, alt_name in alternatives:",
        "            tot = 0.0",
        "            for c in w2:",
        "                s = scores[alt_name].get(c)",
        "                if s is None:",
        "                    continue",
        "                tot += w2[c] * s",
        "            norm2 = (tot / max2 * 100.0) if max2 > 0 else 0.0",
        "            rows.append({'alternative': alt_name, 'normalized': norm2})",
        "        rows = sorted(rows, key=lambda r: r['normalized'], reverse=True)",
        "        scenarios.append({",
        "            'criterion': crit_name,",
        "            'factor': factor,",
        "            'top_ranked': rows[0]['alternative'] if rows else None,",
        "            'top3': [r['alternative'] for r in rows[:3]],",
        "        })",
        "",
        "summary = {",
        "    'workbook_id': WORKBOOK_ID,",
        "    'timestamp': datetime.now(timezone.utc).isoformat(),",
        "    'alternatives': [a for _c, a in alternatives],",
        "    'criteria': [{'name': c, 'weight': w} for _r, c, w in criteria],",
        "    'results': results_sorted,",
        "    'top_recommendation': results_sorted[0] if results_sorted else None,",
        "    'sensitivity': scenarios,",
        "    'notes': [",
        "        'This is a first-order trade study: weighted scoring + simple sensitivity sweep.',",
        "        'Next steps: add uncertainty distributions, feasibility constraints, and driver identification (Sobol).',",
        "    ],",
        "}",
        "",
        "(out_dir / 'summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')",
        "",
        "# Write a concise markdown report for the LLM + humans",
        "lines = []",
        "lines.append('# UAV Trade Study Results (Auto-generated)\\n')",
        "lines.append(f\"Generated: {summary['timestamp']}\\n\")",
        "lines.append('## Top Recommendation\\n')",
        "if summary['top_recommendation']:",
        "    tr = summary['top_recommendation']",
        "    lines.append(f\"- **{tr['alternative']}** (normalized: **{tr['normalized']}**; weighted_total: {tr['weighted_total']})\\n\")",
        "",
        "lines.append('## Ranked Alternatives\\n')",
        "for i, r in enumerate(summary['results'], start=1):",
        "    lines.append(f\"{i}. {r['alternative']} — {r['normalized']}\\n\")",
        "",
        "lines.append('\\n## Sensitivity (±20% on top 3 weights)\\n')",
        "for s in scenarios:",
        "    pct = int((s['factor'] - 1.0) * 100)",
        "    sign = '+' if pct >= 0 else ''",
        "    lines.append(f\"- {s['criterion']}: {sign}{pct}% -> top: **{s['top_ranked']}** (top3: {', '.join(s['top3'])})\")",
        "",
        "lines.append('\\n## Next Steps\\n')",
        "lines.append('- Validate scores with SMEs; replace heuristic scores with measured data where available')",
        "lines.append('- Identify hard constraints (feasibility) and separate them from soft value trade-offs')",
        "lines.append('- Add uncertainty ranges/distributions; run DOE + Sobol to identify drivers')",
        "lines.append('- Generate Pareto frontiers (cost/schedule/risk vs mission value)\\n')",
        "",
        "(out_dir / 'study_report.md').write_text('\\n'.join(lines) + '\\n', encoding='utf-8')",
        "",
        "print('Ready: trade study computed')",
        "print('Wrote:')",
        "print(' -', out_dir / 'summary.json')",
        "print(' -', out_dir / 'study_report.md')",
        "print('Top recommendation:', summary['top_recommendation']['alternative'] if summary['top_recommendation'] else None)",
      ].join("\n"),
      metadata: {},
      outputs: [],
      execution_count: null,
    },
    {
      cell_type: "markdown",
      source:
        "## Suggested next steps (walk-up plan)\n\n1. Sensitivity on weights (+/- 20%)\n2. Identify drivers (Sobol indices) for key MOEs\n3. Feasibility mapping under hard constraints\n4. Pareto frontier exploration (cost vs mission value vs risk)\n",
      metadata: {},
    },
  ];

  return {
    cells,
    metadata: {
      kernelspec: { name: "python3", display_name: "Python 3", language: "python" },
    },
    nbformat: 4,
    nbformat_minor: 2,
  };
}

function createUavRecommendationDoc(): string {
  return `# UAV Trade Study Recommendation (Disaster Response)\n\n## Executive Summary\n\n- **Recommendation**: (to be filled)\n- **Why**: (tie to COIs/COICs)\n- **Residual Risk**: (to be filled)\n\n## Problem / Mission Context\n\nSummarize the mission gap and mission threads.\n\n## COIs (Critical Operational Issues)\n\nList the yes/no operational questions.\n\n## COICs (Criteria) + Measures\n\nMap COIs → COICs → measures (MOE/MOP/MOS).\n\n## Options Considered\n\nUse the A/B/C/D framing:\n- Option A: Accept as-is\n- Option B: Modify/upgrade\n- Option C: Integrate external solution\n- Option D: Defer\n\n## Trade Summary\n\n- Cost / schedule / performance / risk / mission value\n\n## Decision + Rationale\n\n## Evidence\n\nLink to:\n- \`trade/uas_specifications.md\`\n- \`trade/disaster_response_requirements.md\`\n- \`trade/decision_matrix_template.md\`\n- \`trade/decision_matrix.is\`\n- \`trade/trade_study.ipynb\`\n- \`trade/results/summary.json\`\n- \`trade/results/study_report.md\`\n\n## Next Analyses (Planned)\n\n- Pareto frontier exploration\n- Driver identification (Sobol)\n- Feasibility mapping\n- Sensitivity sweeps on weights and thresholds\n`;
}

export function seedDemoWorkbooksIfNeeded(dataDir: string, opts: SeedOpts = {}) {
  if (opts.disabled) return;
  if (process.env.INSIGHTLM_DISABLE_DEMO_SEED === "1" || process.env.INSIGHTLM_DISABLE_DEMO_SEED === "true") {
    return;
  }

  const forceSeed =
    process.env.INSIGHTLM_FORCE_DEMO_SEED === "1" || process.env.INSIGHTLM_FORCE_DEMO_SEED === "true";
  const forceActivateContext =
    process.env.INSIGHTLM_FORCE_DEMO_SEED_ACTIVATE === "1" ||
    process.env.INSIGHTLM_FORCE_DEMO_SEED_ACTIVATE === "true";

  const workbooksDir = path.join(dataDir, "workbooks");
  ensureDir(workbooksDir);

  const markerDir = path.join(dataDir, ".seed");
  const markerPath = path.join(markerDir, "demo-workbooks-v1.json");
  const existingMarker = readIfExists(markerPath);
  const existingWorkbooks = listDirs(workbooksDir);

  // Seed only on "fresh" installs:
  // - no marker, and
  // - workbooks directory is empty (or missing)
  if (!forceSeed && (existingMarker || existingWorkbooks.length > 0)) return;

  ensureDir(markerDir);

  const workbookAlreadyExists = (workbookId: string) => fs.existsSync(path.join(workbooksDir, workbookId));

  // --- Standard demo workbooks (existing set) ---
  // Note: these mirror `tests/create-standard-test-data.mjs` but are generated on first run
  // so relative dates remain reasonable.
  const today = new Date();
  const isoDate = (daysFromNow: number) =>
    new Date(today.getTime() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  createWorkbookOnDisk(
    workbooksDir,
    "ac1000-main-project",
    "AC-1000 Aircraft",
    [],
    [
      {
        filename: "project_overview.md",
        relPath: "documents/project_overview.md",
        addedAt: "2025-01-01T10:00:00Z",
        content: `# AC-1000 Aircraft Project Overview\n\n## Project Details\n- **Aircraft Type**: Light Business Jet\n- **Max Takeoff Weight**: 12,500 lbs\n- **Cruise Speed**: 450 knots\n- **Range**: 2,500 nautical miles\n- **Passenger Capacity**: 6-8\n\n## Project Status\n- **Phase**: Detailed Design\n- **Completion**: 65%\n- **Next Milestone**: PDR (Preliminary Design Review)\n- **PDR Date**: 2025-03-15\n\n## Key Systems\n- Wing structure\n- Main landing gear\n- Nose landing gear\n- Fuel system\n- Avionics suite\n`,
      },
      {
        filename: "design_requirements.md",
        relPath: "documents/design_requirements.md",
        addedAt: "2025-01-02T10:00:00Z",
        content: `# AC-1000 Design Requirements\n\n## Structural Requirements\n- **Ultimate Load Factor**: 3.75g\n- **Limit Load Factor**: 2.5g\n- **Wing Load**: 50 psf maximum\n\n## Performance Requirements\n- **Takeoff Distance**: < 3,500 ft\n- **Landing Distance**: < 2,800 ft\n- **Service Ceiling**: 45,000 ft\n\n## Safety Requirements\n- **Minimum MOS (Margin of Safety)**: 0.15\n- **Critical Components MOS**: > 0.25\n- **Fatigue Life**: 30,000 flight hours\n`,
      },
      {
        filename: "main_gear_analysis.md",
        relPath: "documents/main_gear_analysis.md",
        addedAt: "2025-01-03T10:00:00Z",
        content: `# Main Landing Gear Structural Analysis\n\n## Load Cases\n1. **Landing Impact**: 6.0g vertical\n2. **Braking**: 4.5g longitudinal\n3. **Side Load**: 3.0g lateral\n\n## Component Analysis\n\n### Trunnion\n- **Applied Load**: 45,000 lbs\n- **Allowable Load**: 60,000 lbs\n- **Margin of Safety (MOS)**: **0.33**\n\n### Shock Strut\n- **Applied Load**: 38,000 lbs\n- **Allowable Load**: 50,000 lbs\n- **Margin of Safety (MOS)**: **0.32**\n\n### Axle\n- **Applied Load**: 52,000 lbs\n- **Allowable Load**: 68,000 lbs\n- **Margin of Safety (MOS)**: **0.31**\n\n### Brake Assembly\n- **Applied Load**: 42,000 lbs\n- **Allowable Load**: 52,000 lbs\n- **Margin of Safety (MOS)**: **0.24**\n\n## Design Requirements\n- **Minimum MOS Required**: 0.15\n- **Preferred MOS**: 0.25\n- **Critical Components MOS**: > 0.25\n`,
      },
      {
        filename: "nose_gear_analysis.md",
        relPath: "documents/nose_gear_analysis.md",
        addedAt: "2025-01-04T10:00:00Z",
        content: `# Nose Landing Gear Structural Analysis\n\n## Load Cases\n1. **Landing Impact**: 5.0g vertical\n2. **Steering**: 2.5g lateral\n\n## Component Analysis\n\n### Trunnion\n- **Applied Load**: 18,000 lbs\n- **Allowable Load**: 28,000 lbs\n- **Margin of Safety (MOS)**: **0.56**\n\n### Shock Strut\n- **Applied Load**: 16,500 lbs\n- **Allowable Load**: 24,000 lbs\n- **Margin of Safety (MOS)**: **0.45**\n\n### Steering Actuator\n- **Applied Load**: 12,000 lbs\n- **Allowable Load**: 15,000 lbs\n- **Margin of Safety (MOS)**: **0.25**\n\n## Design Requirements\n- **Minimum MOS Required**: 0.15\n- **Preferred MOS**: 0.25\n`,
      },
      {
        filename: "wing_spar_analysis.md",
        relPath: "documents/wing_spar_analysis.md",
        addedAt: "2025-01-05T10:00:00Z",
        content: `# Wing Main Spar Analysis\n\n## Critical Sections\n\n### Root Section (Station 0)\n- **Bending Moment**: 450,000 in-lbs\n- **Allowable**: 600,000 in-lbs\n- **Margin of Safety (MOS)**: **0.33**\n\n### Mid-Span (Station 100)\n- **Bending Moment**: 280,000 in-lbs\n- **Allowable**: 350,000 in-lbs\n- **Margin of Safety (MOS)**: **0.25**\n\n### Outboard (Station 180)\n- **Bending Moment**: 95,000 in-lbs\n- **Allowable**: 115,000 in-lbs\n- **Margin of Safety (MOS)**: **0.21**\n\n## Design Requirements\n- **Minimum MOS Required**: 0.15\n- **Preferred MOS**: 0.25\n- **Critical Sections MOS**: > 0.25\n`,
      },
    ],
  );

  if (!workbookAlreadyExists("test-schedule-ac1000")) {
    createWorkbookOnDisk(
      workbooksDir,
      "test-schedule-ac1000",
      "Test Schedule",
      [],
      [
      {
        filename: "test_schedule.md",
        relPath: "documents/test_schedule.md",
        addedAt: "2025-01-10T10:00:00Z",
        content: `# AC-1000 Test Schedule\n\n## Static Testing\n\n### Main Gear Static Test\n- **Test Date**: ${isoDate(45)}\n- **Prerequisites**: Complete\n- **Test Article**: Ready\n\n### Nose Gear Static Test\n- **Test Date**: ${isoDate(85)}\n- **Prerequisites**: 90% complete\n- **Test Article**: In fabrication\n\n### Wing Spar Static Test\n- **Test Date**: ${isoDate(125)}\n- **Prerequisites**: 60% complete\n- **Test Article**: Not started\n\n## Fatigue Testing\n\n### Landing Gear Fatigue\n- **Test Date**: ${isoDate(180)}\n- **Cycles Required**: 30,000\n- **Duration**: 8 weeks\n\n## Milestones\n- **Critical Design Review (CDR)**: ${isoDate(30)}\n- **First Flight**: ${isoDate(365)}\n`,
      },
      {
        filename: "test_readiness.md",
        relPath: "documents/test_readiness.md",
        addedAt: "2025-01-11T10:00:00Z",
        content: `# Test Readiness Status\n\n## Upcoming Tests\n\n### Main Gear Static Test\n- **Action Required**: Final instrumentation checkout\n- **Owner**: Structures Team\n- **Priority**: Critical\n\n### Nose Gear Static Test\n- **Action Required**: Complete test article fabrication\n- **Owner**: Test Lab\n- **Priority**: High\n\n## Risk Items\n- Main gear test fixture requires calibration (15 day lead time)\n- Nose gear test article 2 weeks behind schedule\n`,
      },
      ],
    );
  }

  if (!workbookAlreadyExists("supplier-agreements")) {
    createWorkbookOnDisk(
      workbooksDir,
      "supplier-agreements",
      "Supplier Agreements",
      [],
      [
      {
        filename: "Acme_Aerospace_NDA_Expires_2025-08-15.md",
        relPath: "documents/Acme_Aerospace_NDA_Expires_2025-08-15.md",
        addedAt: "2024-08-15T10:00:00Z",
        content: `# Non-Disclosure Agreement - Acme Aerospace\n\n**Company**: Acme Aerospace Inc.\n**Agreement Type**: Mutual NDA\n**Signed Date**: 2024-08-15\n**Expiration Date**: 2025-08-15\n\n## Scope\n- Landing gear components\n- Hydraulic systems\n- Manufacturing processes\n\n## Contact\n- **Name**: John Smith\n- **Email**: jsmith@acmeaero.com\n- **Phone**: 555-0100\n`,
      },
      {
        filename: "TitaniumWorks_NDA_Expires_2026-03-20.md",
        relPath: "documents/TitaniumWorks_NDA_Expires_2026-03-20.md",
        addedAt: "2025-01-10T10:00:00Z",
        content: `# Non-Disclosure Agreement - TitaniumWorks LLC\n\n**Company**: TitaniumWorks LLC\n**Agreement Type**: Mutual NDA\n**Signed Date**: 2025-01-10\n**Expiration Date**: 2026-03-20\n\n## Scope\n- Wing spar materials\n- Heat treatment processes\n- Quality specifications\n\n## Contact\n- **Name**: Sarah Johnson\n- **Email**: sjohnson@titaniumworks.com\n- **Phone**: 555-0200\n`,
      },
      {
        filename: "GlobalAvionics_NDA_Expires_2025-06-30.md",
        relPath: "documents/GlobalAvionics_NDA_Expires_2025-06-30.md",
        addedAt: "2024-06-30T10:00:00Z",
        content: `# Non-Disclosure Agreement - Global Avionics\n\n**Company**: Global Avionics Corp\n**Agreement Type**: One-way NDA\n**Signed Date**: 2024-06-30\n**Expiration Date**: 2025-06-30\n\n## Scope\n- Flight control systems\n- Autopilot integration\n- Display specifications\n\n## Contact\n- **Name**: Mike Chen\n- **Email**: mchen@globalavionics.com\n- **Phone**: 555-0300\n`,
      },
      ],
    );
  }

  if (!workbookAlreadyExists("project-budget")) {
    createWorkbookOnDisk(
      workbooksDir,
      "project-budget",
      "Budget & Costs",
      [],
      [
      {
        filename: "project_budget_2025.csv",
        relPath: "documents/project_budget_2025.csv",
        addedAt: "2025-01-15T10:00:00Z",
        content: `Category,Budgeted,Actual,Variance,Percent\nEngineering,500000,485000,15000,97.0\nManufacturing,1200000,1350000,-150000,112.5\nTesting,300000,275000,25000,91.7\nMaterials,800000,825000,-25000,103.1\nLabor,600000,580000,20000,96.7\nTotal,3400000,3515000,-115000,103.4\n`,
      },
      {
        filename: "cost_tracking.md",
        relPath: "documents/cost_tracking.md",
        addedAt: "2025-01-16T10:00:00Z",
        content: `# AC-1000 Cost Tracking Summary\n\n## Budget Overview\n- **Total Budget**: $3,400,000\n- **Actual Spend**: $3,515,000\n- **Variance**: -$115,000\n\n## Cost Breakdown\n\n### Engineering\n- **Budgeted**: $500,000\n- **Actual**: $485,000\n- **Variance**: $15,000\n- Design: $280,000\n- Analysis: $125,000\n- CAD/CAM: $80,000\n\n### Manufacturing\n- **Budgeted**: $1,200,000\n- **Actual**: $1,350,000\n- **Variance**: -$150,000\n- Tooling: $450,000\n- Fabrication: $600,000\n- Assembly: $300,000\n\n### Testing\n- **Budgeted**: $300,000\n- **Actual**: $275,000\n- **Variance**: $25,000\n- Test fixtures: $125,000\n- Instrumentation: $85,000\n- Lab time: $65,000\n\n### Materials\n- **Budgeted**: $800,000\n- **Actual**: $825,000\n- **Variance**: -$25,000\n- Aluminum: $300,000\n- Titanium: $225,000\n- Composites: $180,000\n- Hardware: $120,000\n\n## Risk Items\n- Manufacturing costs require review\n- Material costs increased due to titanium price increase\n- Cost reduction measures needed in fabrication\n`,
      },
      ],
    );
  }

  // --- UAV Trade Study workbook (new seeded demo) ---
  const seedRoot =
    opts.seedSourceDir ||
    (process.resourcesPath ? path.join(process.resourcesPath, "demo", "trade_study_example") : "");
  const devSeedRoot = path.join(process.cwd(), "data", "trade_study_example");
  const sourceDir = seedRoot && fs.existsSync(seedRoot) ? seedRoot : devSeedRoot;

  const uas = readIfExists(path.join(sourceDir, "uas_specifications.md")) || "# Missing uas_specifications.md\n";
  const reqs =
    readIfExists(path.join(sourceDir, "disaster_response_requirements.md")) ||
    "# Missing disaster_response_requirements.md\n";
  const matrixTpl =
    readIfExists(path.join(sourceDir, "decision_matrix_template.md")) || "# Missing decision_matrix_template.md\n";

  const uavWorkbookId = "uav-trade-study";
  const decisionMatrix = createUavDecisionMatrixSheet(uavWorkbookId);
  const notebook = createUavNotebook();

  // Seed an active Context that scopes to this workbook, so Chat/RAG/Dashboards show "active context".
  try {
    const contextsDir = path.join(dataDir, "contexts");
    ensureDir(contextsDir);
    const ctxId = "9d7c1f2c-28f3-4b68-9f03-1a8b59c8b2c1";
    const nowIso = new Date().toISOString();
    const ctx = {
      id: ctxId,
      name: "UAV Trade Study",
      workbook_ids: [uavWorkbookId],
      folders: ["trade"],
      created: nowIso,
      updated: nowIso,
    };
    fs.writeFileSync(path.join(contextsDir, `${ctxId}.json`), JSON.stringify(ctx, null, 2), "utf-8");
    const activePath = path.join(contextsDir, "active.json");
    const activeExisting = readIfExists(activePath);
    if (forceActivateContext || !activeExisting) {
      fs.writeFileSync(activePath, JSON.stringify({ context_id: ctxId, activatedAt: nowIso }, null, 2), "utf-8");
    }
  } catch {
    // Non-fatal: seeding should be fail-soft.
  }

  // Seed a dashboard that references the UAV trade study artifacts.
  try {
    const dashboardsDir = path.join(dataDir, "dashboards");
    ensureDir(dashboardsDir);
    const dashboardsFile = path.join(dashboardsDir, "dashboards.json");
    const existing = readIfExists(dashboardsFile);
    const parsed = existing
      ? (() => {
          try {
            return JSON.parse(existing);
          } catch {
            return [];
          }
        })()
      : [];
    const dashboards = Array.isArray(parsed) ? parsed : [];
    const hasUavDash =
      dashboards.some((d: any) => d?.id === "f2d5c2ad-6c6a-4d8a-b734-fcff5f1a8d10") ||
      dashboards.some((d: any) => String(d?.name || "") === "UAV Trade Study Dashboard");

    if (!hasUavDash) {
      const nowIso = new Date().toISOString();
      dashboards.push({
        id: "f2d5c2ad-6c6a-4d8a-b734-fcff5f1a8d10",
        name: "UAV Trade Study Dashboard",
        createdAt: nowIso,
        updatedAt: nowIso,
        queries: [
          {
            id: "2f0c9b3d-5e0b-4a66-84f0-6f8c7a8a0f11",
            question:
              "Summarize the top recommendation and ranked alternatives based on workbook://uav-trade-study/documents/trade/results/summary.json",
            queryType: "custom",
            tileType: "text",
            tileSize: "full-width",
            tilePosition: { x: 0, y: 0 },
            createdAt: nowIso,
          },
          {
            id: "c3a6a1c4-1a5f-4c92-a3c2-8b85f4f3d777",
            question:
              "Show a table of alternatives and normalized scores from workbook://uav-trade-study/documents/trade/results/summary.json",
            queryType: "custom",
            tileType: "table",
            tileSize: "full-width",
            tilePosition: { x: 0, y: 2 },
            createdAt: nowIso,
          },
          {
            id: "7e6ff6b1-7db4-4d4d-9804-3ef2a2a7b3c0",
            question:
              "Create a bar graph of normalized scores for each alternative from workbook://uav-trade-study/documents/trade/results/summary.json",
            queryType: "custom",
            tileType: "graph",
            tileSize: "large",
            tilePosition: { x: 0, y: 4 },
            createdAt: nowIso,
          },
        ],
      });
      fs.writeFileSync(dashboardsFile, JSON.stringify(dashboards, null, 2), "utf-8");
    }
  } catch {
    // Non-fatal
  }

  if (!workbookAlreadyExists(uavWorkbookId)) {
    createWorkbookOnDisk(
      workbooksDir,
      uavWorkbookId,
      "UAV Trade Study (Disaster Response)",
      ["trade"],
      [
      { filename: "uas_specifications.md", relPath: "documents/trade/uas_specifications.md", content: uas },
      { filename: "disaster_response_requirements.md", relPath: "documents/trade/disaster_response_requirements.md", content: reqs },
      { filename: "decision_matrix_template.md", relPath: "documents/trade/decision_matrix_template.md", content: matrixTpl },
      { filename: "decision_matrix.is", relPath: "documents/trade/decision_matrix.is", content: JSON.stringify(decisionMatrix, null, 2) },
      { filename: "trade_study.ipynb", relPath: "documents/trade/trade_study.ipynb", content: JSON.stringify(notebook, null, 2) },
      { filename: "recommendation.md", relPath: "documents/trade/recommendation.md", content: createUavRecommendationDoc() },
      { filename: "summary.json", relPath: "documents/trade/results/summary.json", content: "{}" },
      { filename: "study_report.md", relPath: "documents/trade/results/study_report.md", content: "# Trade study report will be generated by running the notebook.\n" },
      {
        filename: "video_walkthrough.md",
        relPath: "documents/trade/video_walkthrough.md",
        content:
          "# Video Walkthrough: UAV Trade Study (Disaster Response)\n\n## Goal\n\nDemonstrate a first-order trade study workflow end-to-end in InsightLM-LT:\n- canonical inputs in an Insight Sheet\n- analysis in a notebook\n- results communicated via a dashboard + a recommendation memo\n- **active context** is visible and applied to chat\n\n## Steps to record\n\n1. **Confirm active context**\n   - In the left header, show: `Scope: UAV Trade Study` and `SCOPED`.\n   - (If needed) expand **Contexts** and click the `SCOPED/ALL` toggle until it shows `SCOPED`.\n\n2. **Open the canonical sheet**\n   - Open `trade/decision_matrix.is`.\n   - Show the `Decision Matrix` tab (weights + scores).\n   - Show the `COIC & Measures` tab (COIs → measures).\n   - Make one small change (e.g., weight or score) and save.\n\n3. **Run the notebook**\n   - Open `trade/trade_study.ipynb`.\n   - Run the first code cell.\n   - Confirm it writes:\n     - `trade/results/summary.json`\n     - `trade/results/study_report.md`\n\n4. **Open the results report**\n   - Open `trade/results/study_report.md` and scroll through the ranked list + sensitivity section.\n\n5. **Dashboard**\n   - Open Dashboards and select `UAV Trade Study Dashboard`.\n   - Refresh tiles (if needed) so they render from `trade/results/summary.json`.\n\n6. **Ask Chat to draft the recommendation memo**\n\nPaste this into Chat:\n\n\"Using workbook://uav-trade-study/documents/trade/results/summary.json and workbook://uav-trade-study/documents/trade/results/study_report.md, write a concise recommendation memo and save it to workbook://uav-trade-study/documents/trade/recommendation.md. Include: recommendation, rationale, risks, and next steps.\"\n\nThen open `trade/recommendation.md` to show the generated memo.\n",
      },
      {
        filename: "README.md",
        relPath: "documents/trade/README.md",
        content:
          "# UAV Trade Study Demo\n\nThis workbook is seeded to demonstrate how InsightLM‑LT can support a **first-order trade study** with:\n- a canonical Insight Sheet (`.is`) for the decision matrix + COICs/measures\n- an in-app Jupyter notebook (`.ipynb`) that computes results + writes artifacts\n- Chat + Dashboard to communicate results\n\n## Open in order\n\n1. `decision_matrix.is` (Insight Sheet)\n2. `trade_study.ipynb` (Jupyter notebook) → run the first code cell\n3. `trade/results/study_report.md` (auto-generated)\n4. `recommendation.md` (use Chat to draft/update)\n\n## Video walkthrough\n\nSee: `trade/video_walkthrough.md`\n\n## Suggested Chat prompt (for video)\n\nAfter running the notebook, paste this into Chat:\n\n\"Using workbook://uav-trade-study/documents/trade/results/summary.json and workbook://uav-trade-study/documents/trade/results/study_report.md, write a concise recommendation memo and save it to workbook://uav-trade-study/documents/trade/recommendation.md. Include: recommendation, rationale, risks, and next steps.\"\n",
      },
      ],
    );
  }

  // Write marker so we don't seed again
  fs.writeFileSync(
    markerPath,
    JSON.stringify(
      {
        version: 1,
        seededAt: new Date().toISOString(),
        workbooks: [
          "ac1000-main-project",
          "test-schedule-ac1000",
          "supplier-agreements",
          "project-budget",
          "uav-trade-study",
        ],
        forceSeed,
      },
      null,
      2,
    ),
    "utf-8",
  );
}
