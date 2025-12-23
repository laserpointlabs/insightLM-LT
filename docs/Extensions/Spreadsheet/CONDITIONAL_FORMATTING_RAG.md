# Conditional Formatting in RAG Context

## Overview

Conditional formatting rules from spreadsheets are now exposed to the LLM through RAG indexing. This allows the LLM to understand visual formatting rules and conditions applied to cells, such as "cell turns red when value > 100".

## Implementation

### 1. Data Storage (`SpreadsheetViewer.tsx`)

**Updated `.is` file format** to include conditional formatting:
```typescript
interface SpreadsheetData {
  sheets: Array<{
    id: string;
    name: string;
    cells: Record<string, any>;
    formats: Record<string, any>;
    conditionalFormats?: Record<string, any>; // NEW: Conditional formatting rules
  }>;
}
```

**Extraction from Luckysheet** (`convertFromLuckysheetFormat`):
- Extracts `luckysheet_conditionformat` from Luckysheet sheet data
- Stores rules in `conditionalFormats` object keyed by cell range
- Preserves rule structure: `{ type, cellrange, condition, value, format }`

**Loading into Luckysheet** (`convertToLuckysheetFormat`):
- Converts `conditionalFormats` back to `luckysheet_conditionformat` array
- Ensures conditional formatting is preserved when loading spreadsheets

### 2. RAG Extraction (`mcp-servers/workbook-rag/server.py`)

**Enhanced `extract_text_from_insight_sheet` function** to include conditional formatting:

```python
=== Conditional Formatting ===
Conditional format on A1:A10: when value > 100 -> background: #FF0000, font color: white
Conditional format on B5:B20: when formula: =A5>50 -> background: #00FF00
Conditional format on C1:C100: when text contains 'ERROR' -> background: red, bold
```

**Rule Formatting**:
- **Cell Value Rules**: `"when value > 100 -> background: red"`
- **Formula Rules**: `"when formula: =A1>50 -> background: green"`
- **Text Rules**: `"when text contains 'ERROR' -> background: red, bold"`
- **Duplicate/Unique**: `"when duplicate values -> background: yellow"`

**Format Details Extracted**:
- Background color (`bg`, `backgroundColor`, `backColor`)
- Font color (`fc`, `fontColor`, `foreColor`)
- Text styles (bold, italic, underline)

### 3. Cell Range Handling

Supports multiple cell range formats:
- **String format**: `"A1:A10"`
- **Array format**: `[{r:0, c:0}, {r:9, c:0}]` (converted to string)

## Example RAG Output

For a spreadsheet with conditional formatting:

```
Spreadsheet: test-spreadsheet.is
Name: Test Spreadsheet
Workbook ID: ac1000-main-project

=== Sheet: Sheet1 ===
Cell A1: 100
Cell B1: 250
Cell C1: =sum(A1:B1) (formula, calculated value: 350)
Cell D1: 500

=== Formulas ===
C1: =sum(A1:B1) (depends on: A1, B1)

=== Conditional Formatting ===
Conditional format on C1:C1: when value > 300 -> background: #FF0000, font color: white
Conditional format on D1:D10: when value > 400 -> background: #FFA500
```

## LLM Usage

The LLM can now answer questions like:
- "Why is cell C1 red?"
- "What conditions trigger formatting in this spreadsheet?"
- "Which cells have conditional formatting?"
- "What happens when a cell value exceeds 100?"

## Benefits

1. **Transparency**: Users can ask about visual formatting rules
2. **Documentation**: Conditional formatting rules are documented in RAG context
3. **Debugging**: LLM can help identify why cells are formatted
4. **Analysis**: LLM can explain business logic embedded in formatting rules

## Technical Details

### Luckysheet Conditional Formatting Structure

Luckysheet stores conditional formatting in `luckysheet_conditionformat` property:
```javascript
{
  luckysheet_conditionformat: [
    {
      type: 'cellValue',
      cellrange: [{r: 0, c: 2}, {r: 0, c: 2}], // C1
      condition: '>',
      value: 300,
      format: {
        bg: '#FF0000',
        fc: '#FFFFFF',
        bl: false,
        it: false
      }
    }
  ]
}
```

### Supported Rule Types

- `cellValue`: Numeric value comparisons (>, <, =, >=, <=, !=, between)
- `formula`: Formula-based conditions
- `textContains`: Text matching
- `duplicate`: Highlight duplicate values
- `unique`: Highlight unique values

## Files Modified

1. **`src/extensions/spreadsheet/SpreadsheetViewer.tsx`**
   - Added `conditionalFormats` to `SpreadsheetData` interface
   - Updated `convertFromLuckysheetFormat` to extract conditional formatting
   - Updated `convertToLuckysheetFormat` to preserve conditional formatting

2. **`mcp-servers/workbook-rag/server.py`**
   - Enhanced `extract_text_from_insight_sheet` to include conditional formatting rules
   - Added formatting rule parsing and human-readable descriptions

## Date Implemented
December 12, 2025
