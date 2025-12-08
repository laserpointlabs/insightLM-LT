# Workbook Dashboard MCP Server

Generates and executes visualization code for dashboard queries.

## Features

- **Dynamic Code Generation**: Creates Python visualization code on-the-fly
- **Multiple Visualization Types**:

  - 📊 Counter: Simple numeric value
  - ⚠️ Counter with Warning: Number with threshold/warning levels
  - 📈 Graph: Bar, Line, Pie, Scatter charts (using Plotly)
  - 📝 Table: Tabular data display
  - 💬 Text: Markdown-formatted summaries

- **Safe Execution**: Runs generated code in isolated subprocess with timeout
- **Code Storage**: Returns generated code for reproducibility and debugging

## Tools

### `execute_dashboard_query`

**Main entry point** - Complete workflow from question to visualization.

**Input:**

```json
{
  "question": "How many NDAs do we have?",
  "workbookId": "optional-workbook-id"
}
```

**Output:**

```json
{
  "success": true,
  "result": {
    "type": "counter",
    "value": 42,
    "label": "NDAs",
    "subtitle": "42 documents total"
  },
  "generatedCode": "import json\n...",
  "workbookId": "wb-123",
  "workbookName": "NDAs"
}
```

### `analyze_dashboard_question`

Analyzes a question and determines the best visualization type.

### `generate_dashboard_visualization`

Generates and executes code for a specific visualization type.

## Examples

**Counter:**

```
"How many NDAs do we have?"
→ Counter showing total count
```

**Counter with Warning:**

```
"How many NDAs are expiring in 90 days?"
→ Counter with warning levels (green/yellow/red)
```

**Graph:**

```
"Show me a pie chart of document types"
→ Interactive Plotly pie chart
```

**Table:**

```
"List all contracts"
→ Sortable table with filename, type, date, size
```

**Text Summary:**

```
"Summarize all documents in the NDA workbook"
→ Markdown-formatted summary with stats
```

## Installation

```bash
cd mcp-servers/workbook-dashboard
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Testing

```bash
python server.py
```

Then send JSON-RPC requests via stdin.
