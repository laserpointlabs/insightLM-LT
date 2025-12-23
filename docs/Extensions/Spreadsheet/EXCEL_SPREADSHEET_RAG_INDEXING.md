# Excel Spreadsheet RAG Indexing - Formulas Visible!

## Key Principle: No Hidden Equations

Unlike Excel where formulas are "hidden" behind cell values, **Insight Sheets expose all formulas in the RAG context**. This allows the LLM to:
- Understand the calculation logic
- Explain how values are derived
- Suggest formula improvements
- Debug calculation errors
- Provide insights based on formulas

## RAG Indexing Format

When indexing a `.is` spreadsheet file, the content is extracted in this format:

```
Spreadsheet: budget.is (Workbook: Financial Analysis)

Sheet: Budget_2025
Cell A1: 100000 (label: "Revenue")
Cell B1: =A1*0.15 (formula, calculated: 15000, label: "Tax")
Cell C1: =A1-B1 (formula, calculated: 85000, label: "Net Revenue")
Cell A2: 50000 (label: "Expenses")
Cell B2: =A2*0.1 (formula, calculated: 5000, label: "Tax on Expenses")
Cell C2: =A2-B2 (formula, calculated: 45000, label: "Net Expenses")
Cell D1: =C1-C2 (formula, calculated: 40000, label: "Profit")

Summary: This spreadsheet calculates profit from revenue and expenses, applying 15% tax on revenue and 10% tax on expenses.
```

## Implementation in workbook-rag

The `workbook-rag` server should detect `.is` files and extract:
1. **All cell values** (displayed values)
2. **All formulas** (with `=` prefix)
3. **Cell labels/metadata** (if available)
4. **Sheet structure** (sheet names, cell references)
5. **Dependencies** (which cells depend on which)

## Example Extraction

For a spreadsheet with:
- A1: `100`
- B1: `=A1*2` (displays `200`)
- C1: `="Total: "&B1` (displays `Total: 200`)

**RAG Index Content:**
```
Spreadsheet: example.is

Cell A1: 100
Cell B1: =A1*2 (formula, calculated value: 200)
Cell C1: ="Total: "&B1 (formula, calculated value: "Total: 200")

Formulas:
- B1 depends on A1: multiplies A1 by 2
- C1 depends on B1: concatenates "Total: " with B1's value
```

## Benefits

1. **Transparency**: Users can ask "How is this value calculated?" and get formula explanations
2. **Debugging**: LLM can identify formula errors or circular dependencies
3. **Learning**: Users can understand Excel formulas through LLM explanations
4. **Optimization**: LLM can suggest formula improvements or simplifications
5. **Documentation**: Formulas serve as self-documenting code

## MCP Server Endpoint

The spreadsheet-server should provide:

```python
"spreadsheet/get_sheet_data_for_rag"
  Request: { "sheet_id": "sheet1", "workbook_id": "wb1", "filename": "budget.is" }
  Response: {
    "text_content": "Spreadsheet: budget.is\n\nCell A1: 100...",
    "formulas": {
      "B1": { "formula": "=A1*2", "dependencies": ["A1"], "value": 200 }
    },
    "metadata": {
      "workbook_id": "wb1",
      "filename": "budget.is",
      "sheet_name": "Sheet1"
    }
  }
```

This endpoint is called by `workbook-rag` when indexing `.is` files.
