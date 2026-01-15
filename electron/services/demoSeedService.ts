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
  // Note: for a more realistic workflow, alternatives are seeded as `trade/alternatives.csv`
  // and the notebook reads that CSV. This sheet remains a lightweight *proxy* scoring model.
  const alts = [
    { name: "SkyEagle X500", rangeKm: 150, enduranceHr: 9, payloadKg: 3.5, weatherKnots: 25, costM: 1.2, linkKm: 150 },
    // Intentionally leave a couple fields unknown to demonstrate "data gaps" handling in the demo.
    { name: "WingOne Pro", rangeKm: 75, enduranceHr: 5, payloadKg: 1.8, weatherKnots: null as any, costM: 0.45, linkKm: 75 },
    { name: "AeroMapper X8", rangeKm: 200, enduranceHr: 13, payloadKg: 5, weatherKnots: 35, costM: 1.7, linkKm: 200 },
    { name: "QuadCopter T4", rangeKm: 8, enduranceHr: 0.66, payloadKg: 0.8, weatherKnots: 15, costM: 0.12, linkKm: 8 },
    { name: "HexaCopter H6 Heavy", rangeKm: 15, enduranceHr: 0.9, payloadKg: 4, weatherKnots: 25, costM: null as any, linkKm: 15 },
    { name: "OctoCopter Sentinel", rangeKm: 25, enduranceHr: 1.15, payloadKg: 8, weatherKnots: 35, costM: 0.8, linkKm: 25 },
    { name: "Falcon VTOL-X", rangeKm: 100, enduranceHr: 5.5, payloadKg: 2.5, weatherKnots: 25, costM: 0.85, linkKm: 100 },
    { name: "HoverCruise 700", rangeKm: 120, enduranceHr: 7.5, payloadKg: 3.5, weatherKnots: 25, costM: 0.98, linkKm: 120 },
    { name: "TriVector VTOL", rangeKm: 180, enduranceHr: 9.5, payloadKg: 7, weatherKnots: 35, costM: 1.5, linkKm: 180 },
  ];

  const ranges = alts.map((a) => a.rangeKm);
  const ends = alts.map((a) => a.enduranceHr);
  const pays = alts.map((a) => a.payloadKg);
  const winds = alts.map((a) => (typeof a.weatherKnots === "number" ? a.weatherKnots : 0));
  const costs = alts.map((a) => (typeof a.costM === "number" ? a.costM : 0));
  const links = alts.map((a) => a.linkKm);

  const minMax = (xs: number[]) => ({ min: Math.min(...xs), max: Math.max(...xs) });
  const r = minMax(ranges);
  const e = minMax(ends);
  const p = minMax(pays);
  const w = minMax(winds);
  const c = minMax(costs);
  const l = minMax(links);

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
      name: "UAV Trade Model",
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      workbook_id: workbookId,
    },
    sheets: [
      {
        id: "sheet1",
        name: "Decision Matrix (proxy)",
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
              evidence: "workbook://uav-trade-study/documents/trade/alternatives.csv",
              notes: "Use vendor feed (CSV) endurance; for multirotors this is typically not met.",
            },
            {
              id: "COI-005",
              coi: "Can the system provide ≥ 2kg payload capacity?",
              coic: "Payload capacity [T] ≥ 2 kg",
              measure: "Payload capacity",
              units: "kg",
              threshold: "2",
              objective: "5",
              evidence: "workbook://uav-trade-study/documents/trade/alternatives.csv",
              notes: "Use vendor feed (CSV) payload capacity.",
            },
            {
              id: "COI-006",
              coi: "Is acquisition cost ≤ $2M?",
              coic: "Acquisition cost [T] ≤ $2M",
              measure: "Acquisition cost",
              units: "$",
              threshold: "2000000",
              objective: "1000000",
              evidence: "workbook://uav-trade-study/documents/trade/alternatives.csv",
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
        "# UAV Trade Study (in-app)\n\nThis notebook is part of the seeded **UAV Trade Study (Disaster Response)** demo workbook.\n\n- Canonical trade model lives in the Insight Sheet (`trade/trade-model.is`)\n- Alternatives are provided as a vendor-style feed (`trade/alternatives.csv`)\n- This notebook is intended for heavier analysis (feasibility, data gaps, sensitivity, and optional mixes)\n",
      metadata: {},
    },
    {
      cell_type: "code",
      source: [
        "import json, os, string, csv",
        "from pathlib import Path",
        "from datetime import datetime, timezone",
        "",
        "WORKBOOK_ID = 'uav-trade-study'",
        "REL_SHEET = f'workbooks/{WORKBOOK_ID}/documents/trade/trade-model.is'",
        "REL_ALTS = f'workbooks/{WORKBOOK_ID}/documents/trade/alternatives.csv'",
        "REL_OUT_DIR = f'workbooks/{WORKBOOK_ID}/documents/trade/results'",
        "",
        "DATA_DIR = os.environ.get('INSIGHTLM_DATA_DIR')",
        "if not DATA_DIR:",
        "    raise RuntimeError('INSIGHTLM_DATA_DIR is not set; cannot locate workbook storage')",
        "",
        "sheet_path = Path(DATA_DIR) / REL_SHEET",
        "alts_csv_path = Path(DATA_DIR) / REL_ALTS",
        "out_dir = Path(DATA_DIR) / REL_OUT_DIR",
        "out_dir.mkdir(parents=True, exist_ok=True)",
        "",
        "raw = json.loads(sheet_path.read_text(encoding='utf-8'))",
        "",
        "# ---- Extract decision matrix (canonical) ----",
        "mat = next((s for s in raw.get('sheets', []) if str(s.get('name','')).strip() in ['Decision Matrix (proxy)', 'Decision Matrix']), None)",
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
        "# ---- Data gaps + feasibility matrix (more realistic trade study artifacts) ----",
        "# Alternatives are read from a CSV feed (vendor-style) rather than being hand-typed in markdown.",
        "def parse_float(v):",
        "    try:",
        "        if v is None:",
        "            return None",
        "        s = str(v).strip()",
        "        if s == '' or s.lower() in ['na','n/a','unknown','?']:",
        "            return None",
        "        return float(s)",
        "    except Exception:",
        "        return None",
        "",
        "alts_parsed = []",
        "if not alts_csv_path.exists():",
        "    raise RuntimeError(f'Missing alternatives CSV: {alts_csv_path}')",
        "",
        "with alts_csv_path.open('r', encoding='utf-8') as f:",
        "    reader = csv.DictReader(f)",
        "    for row in reader:",
        "        name = (row.get('name') or row.get('alternative') or '').strip()",
        "        if not name:",
        "            continue",
        "        alts_parsed.append({",
        "            'name': name,",
        "            'uas_type': (row.get('uas_type') or row.get('type') or '').strip(),",
        "            'range_km': parse_float(row.get('range_km')),",
        "            'endurance_hr': parse_float(row.get('endurance_hr')),",
        "            'payload_kg': parse_float(row.get('payload_kg')),",
        "            'wind_knots': parse_float(row.get('wind_knots')),",
        "            'cost_m': parse_float(row.get('cost_m')),",
        "            'link_km': parse_float(row.get('link_km')),",
        "        })",
        "",
        "if not alts_parsed:",
        "    raise RuntimeError('No alternatives found in alternatives.csv')",
        "",
        "# Data gaps report",
        "required_fields = ['range_km','endurance_hr','payload_kg','wind_knots','cost_m','link_km']",
        "gaps = []",
        "for a in alts_parsed:",
        "    missing = [f for f in required_fields if a.get(f) is None]",
        "    if missing:",
        "        gaps.append({'alternative': a['name'], 'missing': missing})",
        "",
        "dg_lines = []",
        "dg_lines.append('# Data Gaps (Auto-generated)\\n')",
        "dg_lines.append(f\"Generated: {datetime.now(timezone.utc).isoformat()}\\n\")",
        "if not gaps:",
        "    dg_lines.append('No missing fields detected in the alternatives CSV.')",
        "else:",
        "    dg_lines.append('## Missing fields by alternative\\n')",
        "    for g in gaps:",
        "        dg_lines.append(f\"- **{g['alternative']}**: {', '.join(g['missing'])}\")",
        "    dg_lines.append('\\n## Recommended follow-ups\\n')",
        "    dg_lines.append('- Request vendor test reports for wind tolerance and comms range')",
        "    dg_lines.append('- Request endurance curves vs payload and weather assumptions')",
        "    dg_lines.append('- Confirm unit cost + sustainment assumptions (spares/training)')",
        "",
        "(out_dir / 'data_gaps.md').write_text('\\n'.join(dg_lines) + '\\n', encoding='utf-8')",
        "",
        "# Feasibility matrix (hard constraints)",
        "constraints = [",
        "    {'id': 'C-DEPLOY-001', 'name': 'Data link >= 15 km', 'field': 'link_km', 'op': '>=', 'value': 15},",
        "    {'id': 'C-WIND-001', 'name': 'Wind tolerance >= 25 knots', 'field': 'wind_knots', 'op': '>=', 'value': 25},",
        "    {'id': 'C-END-001', 'name': 'Endurance >= 3 hours', 'field': 'endurance_hr', 'op': '>=', 'value': 3},",
        "    {'id': 'C-PAY-001', 'name': 'Payload >= 2 kg', 'field': 'payload_kg', 'op': '>=', 'value': 2},",
        "    {'id': 'C-COST-001', 'name': 'Unit cost <= $2.0M', 'field': 'cost_m', 'op': '<=', 'value': 2.0},",
        "]",
        "",
        "def eval_constraint(v, op, target):",
        "    if v is None:",
        "        return 'UNKNOWN'",
        "    try:",
        "        if op == '>=':",
        "            return 'PASS' if v >= target else 'FAIL'",
        "        if op == '<=':",
        "            return 'PASS' if v <= target else 'FAIL'",
        "    except Exception:",
        "        return 'UNKNOWN'",
        "    return 'UNKNOWN'",
        "",
        "rows = []",
        "for a in alts_parsed:",
        "    r = {'alternative': a['name']}",
        "    for c in constraints:",
        "        r[c['id']] = eval_constraint(a.get(c['field']), c['op'], c['value'])",
        "    rows.append(r)",
        "",
        "fm_lines = []",
        "fm_lines.append('# Feasibility Matrix (Auto-generated)\\n')",
        "fm_lines.append(f\"Generated: {datetime.now(timezone.utc).isoformat()}\\n\")",
        "fm_lines.append('Hard constraints are evaluated as PASS / FAIL / UNKNOWN (missing data).\\n')",
        "fm_lines.append('| Alternative | ' + ' | '.join([c['id'] for c in constraints]) + ' |')",
        "fm_lines.append('|' + '---|' * (2 + len(constraints)))",
        "for r in rows:",
        "    fm_lines.append('| ' + r['alternative'] + ' | ' + ' | '.join([r[c['id']] for c in constraints]) + ' |')",
        "fm_lines.append('\\n## Constraint definitions\\n')",
        "for c in constraints:",
        "    fm_lines.append(f\"- **{c['id']}**: {c['name']}\")",
        "",
        "(out_dir / 'feasibility_matrix.md').write_text('\\n'.join(fm_lines) + '\\n', encoding='utf-8')",
        "(out_dir / 'feasibility_matrix.json').write_text(json.dumps({'constraints': constraints, 'rows': rows}, indent=2), encoding='utf-8')",
        "",
        "# Bonus: simple multi-UAV mix (small bounded search) over top feasible options",
        "def is_fully_feasible(r):",
        "    return all(r[c['id']] == 'PASS' for c in constraints)",
        "",
        "feasible = [r for r in rows if is_fully_feasible(r)]",
        "spec_by_name = {a['name']: a for a in alts_parsed}",
        "budget_m = 4.0",
        "max_each = 5",
        "",
        "# Choose top-3 by normalized score (if available) to keep search deterministic and small.",
        "top_by_norm = [x['alternative'] for x in results_sorted[:3]] if results_sorted else []",
        "candidates = [n for n in top_by_norm if any(f['alternative'] == n for f in feasible)]",
        "if len(candidates) < 2:",
        "    candidates = [f['alternative'] for f in feasible[:3]]",
        "",
        "mixes = []",
        "if candidates:",
        "    for a in range(0, max_each+1):",
        "        for b in range(0, max_each+1):",
        "            for c in range(0, max_each+1):",
        "                counts = [a, b, c][:len(candidates)]",
        "                if sum(counts) == 0:",
        "                    continue",
        "                cost = 0.0",
        "                ok = True",
        "                for name, cnt in zip(candidates, counts):",
        "                    cm = spec_by_name.get(name, {}).get('cost_m')",
        "                    if cm is None:",
        "                        ok = False",
        "                        break",
        "                    cost += cm * cnt",
        "                if not ok or cost > budget_m:",
        "                    continue",
        "                # objective: maximize weighted normalized sum (proxy)",
        "                score = 0.0",
        "                for name, cnt in zip(candidates, counts):",
        "                    nr = next((r for r in results_sorted if r['alternative'] == name), None)",
        "                    score += (nr['normalized'] if nr else 0.0) * cnt",
        "                mixes.append({'candidates': candidates, 'counts': counts, 'total_cost_m': round(cost,3), 'score': round(score,3)})",
        "",
        "mixes_sorted = sorted(mixes, key=lambda x: x['score'], reverse=True)[:10]",
        "(out_dir / 'mix_candidates.json').write_text(json.dumps({'budget_m': budget_m, 'mixes': mixes_sorted}, indent=2), encoding='utf-8')",
        "",
        "mix_lines = []",
        "mix_lines.append('# Multi-UAV Mix Recommendation (Bonus)\\n')",
        "mix_lines.append(f\"Budget cap (demo): ${budget_m}M\\n\")",
        "if not mixes_sorted:",
        "    mix_lines.append('No feasible mixes found under the demo constraints/budget (or insufficient cost data).')",
        "else:",
        "    best = mixes_sorted[0]",
        "    mix_lines.append('## Top mix (by proxy score)\\n')",
        "    for name, cnt in zip(best['candidates'], best['counts']):",
        "        mix_lines.append(f\"- {name}: {cnt}\")",
        "    mix_lines.append(f\"\\nTotal cost: ${best['total_cost_m']}M\")",
        "    mix_lines.append('\\n## Next steps\\n')",
        "    mix_lines.append('- Validate constraints vs mission threads and operational concepts')",
        "    mix_lines.append('- Replace proxy scoring with scenario simulation (coverage, sorties, risk)')",
        "",
        "(out_dir / 'mix_recommendation.md').write_text('\\n'.join(mix_lines) + '\\n', encoding='utf-8')",
        "",
        "print('Ready: trade study computed')",
        "print('Wrote:')",
        "print(' -', out_dir / 'summary.json')",
        "print(' -', out_dir / 'study_report.md')",
        "print(' -', out_dir / 'data_gaps.md')",
        "print(' -', out_dir / 'feasibility_matrix.md')",
        "print(' -', out_dir / 'mix_candidates.json')",
        "print(' -', out_dir / 'mix_recommendation.md')",
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
  return `# UAV Trade Study Recommendation (Disaster Response)\n\n## Executive Summary\n\n- **Recommendation**: (to be filled)\n- **Why**: (tie to COIs/COICs)\n- **Residual Risk**: (to be filled)\n\n## Problem / Mission Context\n\nSummarize the mission gap and mission threads.\n\n## COIs (Critical Operational Issues)\n\nList the yes/no operational questions.\n\n## COICs (Criteria) + Measures\n\nMap COIs → COICs → measures (MOE/MOP/MOS).\n\n## Options Considered\n\nUse the A/B/C/D framing:\n- Option A: Accept as-is\n- Option B: Modify/upgrade\n- Option C: Integrate external solution\n- Option D: Defer\n\n## Trade Summary\n\n- Cost / schedule / performance / risk / mission value\n\n## Decision + Rationale\n\n## Evidence\n\nLink to:\n- \`trade/alternatives.csv\`\n- \`trade/disaster_response_requirements.md\`\n- \`trade/trade-model.is\`\n- \`trade/requirements.is\`\n- \`trade/trade_study.ipynb\`\n- \`trade/results/summary.json\`\n- \`trade/results/study_report.md\`\n- \`trade/results/data_gaps.md\`\n- \`trade/results/feasibility_matrix.md\`\n- (bonus) \`trade/results/mix_candidates.json\`\n- (bonus) \`trade/results/mix_recommendation.md\`\n\n## Next Analyses (Planned)\n\n- Pareto frontier exploration\n- Driver identification (Sobol)\n- Feasibility mapping\n- Sensitivity sweeps on weights and thresholds\n`;
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
    "Vendor Program Workflow (Disaster Response UAV)",
    ["notes", "vendors", "requirements", "decisions", "risks", "briefs"],
    [
      {
        filename: "INSTRUCTIONS.md",
        relPath: "documents/INSTRUCTIONS.md",
        addedAt: "2025-01-01T10:00:00Z",
        content: `# Demo 1 — Vendor Program Workflow (Disaster Response UAV)\n\n## What this workspace is\n\nThis workbook is a **program operating system** for a disaster-response UAV acquisition / risk-reduction effort.\n\nIt is intentionally structured so that:\n- **Raw inputs** (meeting notes + vendor info) live in stable folders\n- The assistant produces **repeatable derived deliverables** (vendor summary pack + requirements baseline)\n- Demo 2 (Trade Study) consumes the requirements baseline as the canonical start point\n\n## Folder layout (one level)\n\n- \`notes/\` — pilot + vendor meeting notes (raw)\n- \`vendors/\` — vendor capability packets (raw)\n- \`requirements/\` — requirements baseline and trace notes\n- \`decisions/\` — decision log\n- \`risks/\` — risk register\n- \`briefs/\` — derived briefs (weekly status, vendor summary pack)\n\n## Demo flow (recommended)\n\n### Step 1 — Show raw inputs\n\nOpen:\n- \`notes/pilot_workshop_01.md\`\n- \`notes/vendor_sync_01.md\`\n- \`vendors/\` packets\n\n### Step 2 — Generate the vendor summary pack (deliverable)\n\nPaste into Chat (Demo 1 context):\n\n\"Using the meeting notes in this workbook and the vendor packets in \`vendors/\`, write a **Vendor Summary Pack**.\n\nRequirements:\n- One section per vendor with: strengths, gaps, risks, questions, and recommended next steps\n- Include citations to the specific note/vendor files you used\n\nSave it to: workbook://ac1000-main-project/documents/briefs/vendor_summary_pack.md\"\n\nThen open: \`briefs/vendor_summary_pack.md\`\n\n### Step 3 — Generate the requirements baseline for Demo 2 (handoff)\n\nPaste into Chat (still Demo 1 context):\n\n\"Extract a requirements baseline (10–20 requirements) for a **Disaster Response UAV selection trade study**.\n\n- Use stable IDs: REQ-001, REQ-002, ...\n- Each requirement must cite which note(s) it came from\n- Store the result as an Insight Sheet\n\nWrite to: workbook://uav-trade-study/documents/trade/requirements.is\"\n\nThen open the file in the UAV Trade Study workbook (Demo 2).\n\n## Notes\n- If you need a fresh start, use **Demos → Reset Dev Data…**.\n`,
      },
      {
        filename: "pilot_workshop_01.md",
        relPath: "documents/notes/pilot_workshop_01.md",
        addedAt: "2025-01-02T10:00:00Z",
        content: `# Pilot Workshop Notes — Disaster Response UAV (Workshop #1)\n\n**Date**: 2026-01-08\n**Attendees**: Pilot SME (SAR), Ops lead, Program team\n\n## Mission context\n- Typical incident: urban + rural mixed terrain, intermittent comms, high winds in coastal areas\n- Need rapid deployment from a mobile unit (truck)\n\n## Key operational needs (raw)\n- Must deploy on-scene **within 15 minutes** (setup + launch)\n- Must operate in winds up to **25 knots** (objective 35)\n- Must survey **5–10 km² within 2 hours** (coverage rate threshold ~2.5 km²/hr)\n- Mission duration: **≥ 3 hours** (objective 6)\n- Prefer payload capacity **≥ 2 kg** (objective 5)\n- Data: video + stills; need reliable downlink at least **15 km** (objective 25+)\n\n## Constraints / notes\n- Night ops are likely; thermal camera is desirable but not strictly required for phase 1\n- Regulatory: must be operable under local waiver / compliant ops procedures\n\n## Open questions\n- Are we prioritizing fixed-wing endurance or VTOL deployment speed?\n- What is the ceiling budget per air vehicle (rough order)?\n`,
      },
      {
        filename: "vendor_sync_01.md",
        relPath: "documents/notes/vendor_sync_01.md",
        addedAt: "2025-01-03T10:00:00Z",
        content: `# Vendor Sync Notes — UAV Candidates (Sync #1)\n\n**Date**: 2026-01-10\n**Attendees**: Program team + 3 vendors (info packets follow)\n\n## Agenda\n- Confirm mission needs (from pilot workshop)\n- Ask for missing specs and constraints (wind tolerance, endurance with payload, comms range, pricing)\n\n## Notes by vendor (raw)\n\n### Vendor A — AeroMapper\n- Claims strong endurance and payload capacity\n- Wind tolerance stated as \"up to 35 knots\" (needs test evidence)\n- Pricing: higher; lead times unclear\n\n### Vendor B — SkyEagle\n- Emphasizes range and data link\n- Wind tolerance is \"typical 25 knots\" (needs confirmation for gusts)\n- Offers training + spares package\n\n### Vendor C — WingOne\n- Low cost option; quick deployment\n- Endurance may be insufficient for 3+ hour missions\n- Payload limited\n\n## Decisions / actions\n- Request evidence of wind tolerance and comms range (test reports)\n- Request endurance curves with payload and weather assumptions\n`,
      },
      {
        filename: "vendor_packet_aeromapper.md",
        relPath: "documents/vendors/vendor_packet_aeromapper.md",
        addedAt: "2025-01-04T10:00:00Z",
        content: `# Vendor Packet — AeroMapper X8 (Candidate UAV)\n\n## Claimed specs (vendor provided)\n- **Endurance**: 13 hours (no payload); 8 hours (2 kg payload) *(needs evidence)*\n- **Range**: 200 km\n- **Payload**: 5 kg\n- **Wind tolerance**: 35 knots *(needs evidence)*\n- **Data link**: 200 km (LOS)\n- **Cost**: $1.7M (unit), lead time 20–24 weeks\n\n## Notes\n- Strong candidate for long endurance / coverage\n- Risk: pricing + evidence quality\n`,
      },
      {
        filename: "vendor_packet_skyeagle.md",
        relPath: "documents/vendors/vendor_packet_skyeagle.md",
        addedAt: "2025-01-05T10:00:00Z",
        content: `# Vendor Packet — SkyEagle X500 (Candidate UAV)\n\n## Claimed specs (vendor provided)\n- **Endurance**: 9 hours (no payload); 6 hours (2 kg payload)\n- **Range**: 150 km\n- **Payload**: 3.5 kg\n- **Wind tolerance**: 25 knots\n- **Data link**: 150 km (LOS)\n- **Cost**: $1.2M (unit), lead time 16–20 weeks\n\n## Notes\n- Balanced option\n- Potential gap: wind tolerance objective (35 knots)\n`,
      },
      {
        filename: "vendor_packet_wingone.md",
        relPath: "documents/vendors/vendor_packet_wingone.md",
        addedAt: "2025-01-06T10:00:00Z",
        content: `# Vendor Packet — WingOne Pro (Candidate UAV)\n\n## Claimed specs (vendor provided)\n- **Endurance**: 5 hours (no payload); 3 hours (1 kg payload)\n- **Range**: 75 km\n- **Payload**: 1.8 kg\n- **Wind tolerance**: 15 knots\n- **Data link**: 75 km (LOS)\n- **Cost**: $0.45M (unit), lead time 8–12 weeks\n\n## Notes\n- Low-cost / fast procurement candidate\n- Likely fails wind tolerance and may fail endurance with payload\n`,
      },
      {
        filename: "vendor_summary_pack.md",
        relPath: "documents/briefs/vendor_summary_pack.md",
        addedAt: "2025-01-07T10:00:00Z",
        content: `# Vendor Summary Pack (Template)\n\n> This file is intended to be generated/updated by Chat during Demo 1.\n\n## Executive summary\n\n- (to be generated)\n\n## Vendor comparisons (one section per vendor)\n\n### AeroMapper X8\n- Strengths:\n- Gaps:\n- Risks:\n- Questions to ask:\n- Recommended next steps:\n\n### SkyEagle X500\n- Strengths:\n- Gaps:\n- Risks:\n- Questions to ask:\n- Recommended next steps:\n\n### WingOne Pro\n- Strengths:\n- Gaps:\n- Risks:\n- Questions to ask:\n- Recommended next steps:\n\n## Open actions\n\n- (to be generated)\n`,
      },
      {
        filename: "requirements_baseline.md",
        relPath: "documents/requirements/requirements_baseline.md",
        addedAt: "2025-01-07T11:00:00Z",
        content: `# Requirements Baseline (Template)\n\n> This is a human-readable placeholder. For the trade study handoff, Demo 1 writes an Insight Sheet to:\n>\n> \`workbook://uav-trade-study/documents/trade/requirements.is\`\n+\n+## Intended format\n+\n- REQ-### — requirement text\n- Source: cite meeting note(s)\n- Notes: assumptions / open questions\n`,
      },
      {
        filename: "decision_log.md",
        relPath: "documents/decisions/decision_log.md",
        addedAt: "2025-01-07T12:00:00Z",
        content: `# Decision Log\n\n- DEC-001 — (placeholder)\n  - Date:\n  - Decision:\n  - Rationale:\n  - Evidence:\n`,
      },
      {
        filename: "risk_register.md",
        relPath: "documents/risks/risk_register.md",
        addedAt: "2025-01-07T12:30:00Z",
        content: `# Risk Register\n\n- RISK-001 — Vendor spec evidence quality is incomplete\n  - Impact: Could select a platform that fails wind/endurance in real conditions\n  - Mitigation: Request test reports + validate in pilot trials\n  - Evidence: notes/vendor_sync_01.md\n`,
      },
    ],
  );

  // NOTE: We no longer seed the legacy AC-1000 companion workbooks (budget/suppliers/test schedule)
  // by default, because Demo 1 is now "Vendor Program Workflow" and those old fixtures confuse the demo.
  // If we want an Agreements monitoring demo, we can seed a dedicated workbook for it explicitly later.

  // --- UAV Trade Study workbook (new seeded demo) ---
  const seedRoot =
    opts.seedSourceDir ||
    (process.resourcesPath ? path.join(process.resourcesPath, "demo", "trade_study_example") : "");
  const devSeedRoot = path.join(process.cwd(), "data", "trade_study_example");
  const sourceDir = seedRoot && fs.existsSync(seedRoot) ? seedRoot : devSeedRoot;

  // Requirements can remain as a narrative doc; in many real studies this starts as prose before being structured.
  const reqs =
    readIfExists(path.join(sourceDir, "disaster_response_requirements.md")) ||
    "# Missing disaster_response_requirements.md\n";

  const uavWorkbookId = "uav-trade-study";
  const decisionMatrix = createUavDecisionMatrixSheet(uavWorkbookId);
  const notebook = createUavNotebook();
  const alternativesCsv = (() => {
    // Vendor-style alternatives feed (canonical input for the notebook).
    // Intentionally leave a couple fields blank to demonstrate "data gaps".
    const rows = [
      { name: "SkyEagle X500", uas_type: "Fixed-Wing", range_km: 150, endurance_hr: 9, payload_kg: 3.5, wind_knots: 25, cost_m: 1.2, link_km: 150 },
      { name: "WingOne Pro", uas_type: "Fixed-Wing", range_km: 75, endurance_hr: 5, payload_kg: 1.8, wind_knots: "", cost_m: 0.45, link_km: 75 },
      { name: "AeroMapper X8", uas_type: "Fixed-Wing", range_km: 200, endurance_hr: 13, payload_kg: 5, wind_knots: 35, cost_m: 1.7, link_km: 200 },
      { name: "QuadCopter T4", uas_type: "Multirotor", range_km: 8, endurance_hr: 0.66, payload_kg: 0.8, wind_knots: 15, cost_m: 0.12, link_km: 8 },
      { name: "HexaCopter H6 Heavy", uas_type: "Multirotor", range_km: 15, endurance_hr: 0.9, payload_kg: 4, wind_knots: 25, cost_m: "", link_km: 15 },
      { name: "OctoCopter Sentinel", uas_type: "Multirotor", range_km: 25, endurance_hr: 1.15, payload_kg: 8, wind_knots: 35, cost_m: 0.8, link_km: 25 },
      { name: "Falcon VTOL-X", uas_type: "Hybrid VTOL", range_km: 100, endurance_hr: 5.5, payload_kg: 2.5, wind_knots: 25, cost_m: 0.85, link_km: 100 },
      { name: "HoverCruise 700", uas_type: "Hybrid VTOL", range_km: 120, endurance_hr: 7.5, payload_kg: 3.5, wind_knots: 25, cost_m: 0.98, link_km: 120 },
      { name: "TriVector VTOL", uas_type: "Hybrid VTOL", range_km: 180, endurance_hr: 9.5, payload_kg: 7, wind_knots: 35, cost_m: 1.5, link_km: 180 },
    ];
    const header = ["name", "uas_type", "range_km", "endurance_hr", "payload_kg", "wind_knots", "cost_m", "link_km"];
    const esc = (v: any) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/\"/g, "\"\"")}"`;
      return s;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(header.map((h) => esc((r as any)[h])).join(","));
    }
    return lines.join("\n") + "\n";
  })();
  const requirementsSheet = {
    version: "1.0",
    metadata: {
      name: "Trade Study Requirements",
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      workbook_id: uavWorkbookId,
    },
    sheets: [
      {
        id: "sheet1",
        name: "Requirements",
        cells: {
          A1: { value: "REQ_ID" },
          B1: { value: "Text" },
          C1: { value: "Type" },
          D1: { value: "Priority" },
          E1: { value: "SourceRef" },
          F1: { value: "Notes" },
          A2: { value: "REQ-001" },
          B2: { value: "(To be generated in Demo 1 from meeting notes)" },
          C2: { value: "Constraint" },
          D2: { value: "High" },
          E2: { value: "workbook://ac1000-main-project/documents/notes/pilot_workshop_01.md" },
          F2: { value: "" },
        },
        formats: {},
        viewState: { columnWidths: { "0": 120, "1": 520, "2": 120, "3": 110, "4": 420, "5": 260 }, rowHeights: { "0": 26 } },
      },
    ],
  };

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
      { filename: "disaster_response_requirements.md", relPath: "documents/trade/disaster_response_requirements.md", content: reqs },
      { filename: "alternatives.csv", relPath: "documents/trade/alternatives.csv", content: alternativesCsv },
      { filename: "trade-model.is", relPath: "documents/trade/trade-model.is", content: JSON.stringify(decisionMatrix, null, 2) },
      { filename: "requirements.is", relPath: "documents/trade/requirements.is", content: JSON.stringify(requirementsSheet, null, 2) },
      { filename: "trade_study.ipynb", relPath: "documents/trade/trade_study.ipynb", content: JSON.stringify(notebook, null, 2) },
      { filename: "recommendation.md", relPath: "documents/trade/recommendation.md", content: createUavRecommendationDoc() },
      { filename: "summary.json", relPath: "documents/trade/results/summary.json", content: "{}" },
      { filename: "study_report.md", relPath: "documents/trade/results/study_report.md", content: "# Trade study report will be generated by running the notebook.\n" },
      {
        filename: "model.sysml",
        relPath: "documents/trade/model.sysml",
        content:
          "// SysML v2 (demo-light) — Trade Study framing model\n+// Note: this is a plain text artifact for EOM; richer modeling/graph UI is a future extension.\n+\n+package uav_trade_study {\n+  // Requirements baseline is stored in: trade/requirements.is\n+  // Example placeholders:\n+  requirement REQ_001 {\n+    doc /* \"Deploy within 15 minutes\" */;\n+  }\n+  requirement REQ_002 {\n+    doc /* \"Wind tolerance >= 25 knots\" */;\n+  }\n+\n+  part UAV;\n+  part GroundStation;\n+  part DataLink;\n+\n+  constraint WindTolerance {\n+    // wind_knots >= 25\n+  }\n+  constraint Endurance {\n+    // endurance_hr >= 3\n+  }\n+}\n",
      },
      {
        filename: "README.md",
        relPath: "documents/trade/README.md",
        content:
          "# UAV Trade Study (Disaster Response)\n\nThis workbook demonstrates a more realistic trade study workflow:\n- **Canonical trade model**: `trade/trade-model.is`\n- **Alternatives feed (vendor-style)**: `trade/alternatives.csv`\n- **Requirements baseline** (hand-off from Demo 1): `trade/requirements.is`\n- **Notebook analysis** (writes derived artifacts): `trade/trade_study.ipynb`\n- **Decision memo**: `trade/recommendation.md`\n\n## Open in order\n\n1. `trade-model.is`\n2. `alternatives.csv`\n3. `requirements.is`\n4. `trade_study.ipynb` (run the first code cell)\n5. `results/data_gaps.md` + `results/feasibility_matrix.md`\n6. `recommendation.md`\n",
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
