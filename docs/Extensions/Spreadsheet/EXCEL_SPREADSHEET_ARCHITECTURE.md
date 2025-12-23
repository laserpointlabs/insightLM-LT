# Excel-Like Spreadsheet Extension - Architecture Plan

## Executive Summary

**Recommendation:** Create a **separate extension** (not part of JupyterLab) for Excel-like spreadsheets.

**Key Technologies:**
- **Frontend:** Luckysheet (open source, Excel-like UI)
- **Backend:** Python MCP server with pycel (Excel formula engine)
- **File Format:** `.is` (Insight Sheet) JSON format (with .xlsx import/export)

## Why Separate Extension?

1. **Different Mental Models:** Spreadsheets (grid + formulas) vs Notebooks (cells + code execution)
2. **Different Use Cases:** Excel users expect spreadsheet workflows, not notebook workflows
3. **Better UX:** Can optimize UI specifically for spreadsheet editing
4. **Independent Lifecycle:** Can enable/disable separately, version independently

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Spreadsheet Extension                     │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │   Luckysheet UI Component                 │  │  │
│  │  │   - Grid display                           │  │  │
│  │  │   - Cell editing                           │  │  │
│  │  │   - Formula bar                            │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │           ↕ MCP Protocol                          │  │
│  └──────────────────────────────────────────────────┘  │
│                    ↕                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Spreadsheet MCP Server (Python)                │  │
│  │   - pycel formula engine                         │  │
│  │   - Cell dependency tracking                     │  │
│  │   - Calculation management                       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                    ↕
         ┌──────────────────┐
         │  Workbook Storage │
         │  (.is documents)  │
         └──────────────────┘
                    ↕
         ┌──────────────────┐
         │   RAG Indexing    │
         │  (Context-aware)  │
         └──────────────────┘
```

## File Structure

```
src/extensions/spreadsheet/
├── manifest.ts                    # Extension manifest
├── SpreadsheetViewer.tsx          # Main viewer component
├── SpreadsheetEditor.tsx          # Editor component
├── components/
│   ├── FormulaBar.tsx            # Formula input bar
│   ├── CellEditor.tsx            # Inline cell editor
│   └── Grid.tsx                  # Grid wrapper for Luckysheet
├── hooks/
│   ├── useSpreadsheet.ts         # Spreadsheet state management
│   └── useFormulaCalculation.ts  # Formula calculation hook
├── actions/
│   └── createSpreadsheet.ts      # Create new spreadsheet
└── types.ts                       # TypeScript types

mcp-servers/spreadsheet-server/
├── server.py                      # MCP server entry point
├── formula_engine.py             # pycel integration
├── cell_dependencies.py          # Dependency tracking
├── calculation_manager.py        # Calculation orchestration
├── config.json
└── requirements.txt              # pycel, etc.
```

## Data Flow Example

**User enters formula in cell B1: `=A1*2`**

1. **Frontend (Luckysheet):**
   - User types `=A1*2` in cell B1
   - Component detects formula (starts with `=`)
   - Calls MCP server: `spreadsheet/calculate_cell`

2. **MCP Server (Python):**
   - Receives: `{ sheet_id: "sheet1", cell_ref: "B1", formula: "=A1*2" }`
   - Checks dependencies: B1 depends on A1
   - Gets A1 value: `100`
   - Calculates: `100 * 2 = 200`
   - Returns: `{ value: 200, dependencies: ["A1"] }`

3. **Frontend:**
   - Updates cell B1 display to show `200`
   - Formula bar still shows `=A1*2`
   - If A1 changes, B1 automatically recalculates

4. **Persistence:**
   - Spreadsheet saved to workbook as `.is` document (like other documents)
   - Stored in workbook's documents folder: `documents/budget.is`
   - Format: `{ cells: { "A1": { value: 100 }, "B1": { formula: "=A1*2", value: 200 } } }`

5. **RAG Indexing (Formulas Visible!):**
   - Spreadsheet content extracted with **formulas explicitly shown**
   - Format: "Cell A1: 100, Cell B1: =A1*2 (calculated: 200)"
   - **All formulas are indexed** - no hidden equations like Excel!
   - Indexed with metadata: workbook_id, sheet_name, filename
   - Available in LLM context for analysis and explanation

## MCP Server API

### Endpoints

```python
# Calculate a single cell
"spreadsheet/calculate_cell"
  Request: {
    "sheet_id": "sheet1",
    "cell_ref": "B1",
    "formula": "=A1*2",
    "context": { "A1": 100 }  # Current cell values
  }
  Response: {
    "value": 200,
    "error": null,
    "dependencies": ["A1"]
  }

# Get cell value/formula
"spreadsheet/get_cell"
  Request: { "sheet_id": "sheet1", "cell_ref": "B1" }
  Response: {
    "value": 200,
    "formula": "=A1*2",
    "format": "number"
  }

# Set cell value
"spreadsheet/set_cell"
  Request: {
    "sheet_id": "sheet1",
    "cell_ref": "A1",
    "value": 150,
    "formula": null
  }
  Response: {
    "success": true,
    "recalculated_cells": ["B1"]  # Cells that depend on A1
  }

# Recalculate entire sheet
"spreadsheet/recalculate"
  Request: { "sheet_id": "sheet1" }
  Response: {
    "success": true,
    "cells_updated": ["B1", "C1"]
  }

# Get sheet data (for RAG)
"spreadsheet/get_sheet_data"
  Request: { "sheet_id": "sheet1" }
  Response: {
    "cells": { "A1": 100, "B1": 200 },
    "formulas": { "B1": "=A1*2" },
    "metadata": { "name": "Sheet1", "workbook_id": "wb1" }
  }
```

## File Format (.is - Insight Sheet)

```json
{
  "version": "1.0",
  "metadata": {
    "name": "Budget Analysis",
    "created_at": "2025-12-11T12:00:00Z",
    "modified_at": "2025-12-11T12:30:00Z",
    "workbook_id": "wb1"
  },
  "sheets": [
    {
      "id": "sheet1",
      "name": "Sheet1",
      "cells": {
        "A1": { "value": 100, "type": "number" },
        "B1": { "formula": "=A1*2", "value": 200, "type": "number" },
        "C1": { "value": "Total", "type": "text" }
      },
      "formats": {
        "B1": { "numberFormat": "#,##0.00" }
      }
    }
  ]
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
- [x] Create spreadsheet extension structure ✅
- [x] Register extension in App.tsx ✅
- [x] Create MCP server skeleton ✅
- [x] Set up file handler for .is files ✅
- [x] Create basic SpreadsheetViewer component ✅
- [x] Create spreadsheet creation action ✅
- [x] Set up Luckysheet integration ✅
- [x] Basic grid display ✅
- [x] Cell editing (text values only) ✅
- [x] Connect Luckysheet to MCP server for formula calculation ✅

### Phase 2: Formula Engine (Week 2)
- [x] Create spreadsheet-server MCP server ✅
- [x] Install pycel dependency ✅
- [x] Integrate pycel ✅
- [x] Basic formula calculation ✅
- [x] Connect frontend to backend (Luckysheet hooks to MCP) ✅

### Phase 3: Excel Features (Week 3)
- [x] Formula bar UI ✅ (Luckysheet provides this)
- [x] Cell dependency tracking ✅ (MCP server tracks dependencies)
- [x] Auto-recalculation ✅ (Hooks trigger on cell edit)
- [x] Error handling ✅ (MCP server returns errors)
- [ ] Full dependency graph recalculation
- [ ] Circular dependency detection

### Phase 4: Integration (Week 4)
- [x] File persistence (.is format, stored as workbook document) ✅
- [ ] RAG indexing integration (formulas visible in context!)
- [ ] Excel import/export
- [ ] Testing with Excel users

## Key Decisions Made

1. ✅ **Separate extension** (not JupyterLab)
2. ✅ **Luckysheet** for frontend UI
3. ✅ **pycel** for formula engine
4. ✅ **Custom JSON format** (`.is` - Insight Sheet) for storage
5. ✅ **Python MCP server** for calculation backend
6. ✅ **Formulas visible in RAG context** (no hidden equations!)
7. ✅ **Stored as workbook documents** (like PDFs, Word docs, etc.)

## Open Questions

1. Should we support multiple sheets per file? **Yes** (like Excel)
2. Should we support charts/graphs? **Phase 2+**
3. Should formulas support Python functions? **Maybe** (differentiator)
4. How to handle very large spreadsheets? **Virtual scrolling, lazy calculation**

## Next Steps

1. Review and approve architecture
2. Set up extension scaffolding
3. Integrate Luckysheet
4. Create MCP server skeleton
5. Implement basic formula calculation
