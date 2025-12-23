# Excel-Like Spreadsheet Extension - Research & Architecture

## Overview

Goal: Implement an Excel-like spreadsheet capability that:
- Is Python-driven (formulas execute via Python backend)
- Provides Excel-like UI for non-Python users
- Supports background equations/formulas (like Excel)
- Integrates spreadsheets into application context (RAG indexing)
- Feels familiar to Excel users

## Architecture Decision: Separate Extension vs JupyterLab Integration

### Option 1: Separate Extension (Recommended)

**Pros:**
- Clear separation of concerns (spreadsheets ≠ notebooks)
- Can be enabled/disabled independently
- Different file format (`.xlsx` or custom `.insight-sheet`)
- Specialized UI optimized for spreadsheet workflows
- Easier to maintain and test independently
- Can have its own MCP server for formula calculation

**Cons:**
- More code to maintain
- Need separate extension infrastructure

**Structure:**
```
src/extensions/spreadsheet/
├── manifest.ts
├── SpreadsheetViewer.tsx
├── SpreadsheetEditor.tsx
├── components/
│   ├── CellEditor.tsx
│   ├── FormulaBar.tsx
│   └── Grid.tsx
└── actions/
    └── createSpreadsheet.ts

mcp-servers/spreadsheet-server/
├── server.py          # Formula calculation engine
├── config.json
└── requirements.txt   # pycel, formulasheet, or custom engine
```

### Option 2: Add to JupyterLab Extension

**Pros:**
- Reuse existing extension infrastructure
- Single extension for data manipulation
- Can leverage Jupyter's execution model

**Cons:**
- Mixes two different paradigms (notebooks vs spreadsheets)
- Spreadsheet UI doesn't fit notebook cell model well
- Harder to optimize for spreadsheet-specific workflows
- Formula calculation model differs from code execution

**Verdict:** **Option 1 (Separate Extension)** is recommended because spreadsheets and notebooks serve different use cases and user mental models.

## Frontend Spreadsheet Libraries

### Option A: Luckysheet (Open Source, Excel-like)

**Pros:**
- Open source (Apache 2.0)
- Very Excel-like UI/UX
- Built-in formula support (needs backend integration)
- Supports charts, formatting, etc.
- Active development
- React integration available

**Cons:**
- Formula engine is JavaScript-based (we want Python)
- May need to disable built-in formulas and use our Python backend
- Larger bundle size

**GitHub:** https://github.com/dream-num/Luckysheet
**NPM:** `luckysheet`

### Option B: Handsontable (Commercial with Free Tier)

**Pros:**
- Very mature and feature-rich
- Excellent React integration
- Good performance
- Strong formula support (but JavaScript-based)

**Cons:**
- Commercial license required for advanced features
- Free version has limitations
- Formula engine is JavaScript (we want Python backend)

**Website:** https://handsontable.com/
**NPM:** `handsontable`

### Option C: React Spreadsheet (Lightweight)

**Pros:**
- Simple and lightweight
- Good React integration
- Easy to customize

**Cons:**
- Less Excel-like
- Limited features
- No built-in formula support

**GitHub:** https://github.com/iddan/react-spreadsheet
**NPM:** `react-spreadsheet`

### Option D: x-spreadsheet (Lightweight, Excel-like)

**Pros:**
- Lightweight
- Excel-like UI
- Open source

**Cons:**
- Less mature
- Limited features compared to Luckysheet
- Formula support is basic

**GitHub:** https://github.com/myliang/x-spreadsheet
**NPM:** `x-data-spreadsheet`

### Option E: OnlyOffice (Full Office Suite)

**Pros:**
- Full Excel compatibility
- Very feature-rich
- Can be self-hosted

**Cons:**
- Very large (full office suite)
- More complex integration
- May be overkill for our needs

**Recommendation:** **Luckysheet** - Best balance of Excel-like UI, open source, and React integration. We'll disable its built-in formula engine and use our Python backend.

## Backend Formula Calculation Engine (Python)

### Option A: pycel (Excel Formula Engine)

**Pros:**
- Specifically designed for Excel formulas
- Supports most Excel functions
- Can parse Excel files and extract formulas
- Well-maintained

**Cons:**
- May need customization for our use case
- Performance considerations for large sheets

**GitHub:** https://github.com/dgorissen/pycel
**Install:** `pip install pycel`

### Option B: formulasheet (Formula Parser)

**Pros:**
- Lightweight formula parser
- Easy to integrate
- Good for basic formulas

**Cons:**
- Less comprehensive than pycel
- May not support all Excel functions

**GitHub:** https://github.com/vinci1it2000/formulasheet

### Option C: Custom Formula Engine

**Pros:**
- Full control over functionality
- Can optimize for our specific needs
- No external dependencies

**Cons:**
- Significant development time
- Need to implement Excel formula compatibility
- Maintenance burden

### Option D: xlwings + openpyxl (Hybrid)

**Pros:**
- Can leverage Excel's actual calculation engine via COM (Windows)
- Full Excel compatibility
- Can read/write Excel files

**Cons:**
- Windows-only for COM automation
- Requires Excel installed (not ideal)
- Heavier solution

**Recommendation:** **pycel** - Best balance of Excel compatibility and Python-native implementation. We can extend it for our specific needs.

## Architecture Design

### Data Flow

```
User edits cell in UI (Luckysheet)
  ↓
Frontend sends formula/value to MCP server
  ↓
Python MCP server (spreadsheet-server)
  ↓
pycel formula engine calculates result
  ↓
Result sent back to frontend
  ↓
UI updates cell value
  ↓
Spreadsheet data saved to workbook
  ↓
RAG indexing picks up spreadsheet content
```

### File Format

**Option 1: Excel Format (.xlsx)**
- Pros: Standard format, can open in Excel
- Cons: Need to parse/write Excel files, harder to version control

**Option 2: Custom JSON Format (.is - Insight Sheet)**
- Pros: Easy to parse, version control friendly, can add metadata, short extension name
- Cons: Not directly Excel-compatible (but can export)

**Option 3: Hybrid (Store as .xlsx, also maintain JSON cache)**
- Pros: Best of both worlds
- Cons: Need to keep formats in sync

**Recommendation:** **Custom JSON format (`.is` - Insight Sheet)** for internal storage, with export to .xlsx capability. Short, memorable extension name.

### MCP Server Endpoints

```python
# mcp-servers/spreadsheet-server/server.py

# Calculate cell value/formula
"spreadsheet/calculate_cell"
  params: { sheet_id, cell_ref, formula, dependencies }
  returns: { value, error, dependencies_used }

# Get cell value
"spreadsheet/get_cell"
  params: { sheet_id, cell_ref }
  returns: { value, formula, format }

# Set cell value
"spreadsheet/set_cell"
  params: { sheet_id, cell_ref, value, formula }
  returns: { success, recalculated_cells }

# Recalculate entire sheet
"spreadsheet/recalculate"
  params: { sheet_id }
  returns: { success, cells_updated }

# Get sheet data (for RAG indexing)
"spreadsheet/get_sheet_data"
  params: { sheet_id }
  returns: { cells, formulas, metadata }
```

## Integration with Context/RAG

Spreadsheets should be indexed into RAG context:
1. Extract cell values and formulas
2. Create text representation: "Cell A1: 100, Cell B1: =A1*2 (200)"
3. Include metadata: workbook_id, sheet_name, cell references
4. Index via workbook-rag or context-rag

## Implementation Phases

### Phase 1: Basic Spreadsheet UI
- [ ] Create spreadsheet extension manifest
- [ ] Integrate Luckysheet (or chosen library)
- [ ] Basic grid display and cell editing
- [ ] File creation (.insight-sheet format)

### Phase 2: Formula Engine Backend
- [ ] Create spreadsheet-server MCP server
- [ ] Integrate pycel formula engine
- [ ] Implement basic formula calculation
- [ ] Handle cell dependencies

### Phase 3: Formula Integration
- [ ] Connect frontend to backend MCP server
- [ ] Formula bar UI
- [ ] Real-time calculation on cell changes
- [ ] Error handling and display

### Phase 4: Excel Compatibility
- [ ] Import from .xlsx files
- [ ] Export to .xlsx files
- [ ] Formula compatibility testing

### Phase 5: Context Integration
- [ ] RAG indexing of spreadsheet content
- [ ] Formula explanations in context
- [ ] Spreadsheet metadata in context

## Next Steps

1. **Decision:** Confirm separate extension approach
2. **Prototype:** Create basic spreadsheet extension with Luckysheet
3. **Backend:** Set up spreadsheet-server MCP with pycel
4. **Integration:** Connect frontend to backend
5. **Testing:** Test with Excel users for UX validation

## Questions to Resolve

1. Should we support multiple sheets per file? (Yes, like Excel)
2. Should we support charts/graphs? (Phase 2+)
3. Should we support Excel macros/VBA? (Probably not initially)
4. How do we handle very large spreadsheets? (Virtual scrolling, lazy calculation)
5. Should formulas support Python functions? (Could be a differentiator)
