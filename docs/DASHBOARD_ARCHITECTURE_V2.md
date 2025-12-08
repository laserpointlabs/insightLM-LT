# Dashboard Architecture V2 - Prompt Manager

## Overview

The new dashboard architecture is **decoupled and clean**:
- Dashboard MCP Server = **Prompt Manager** (no file reading, no code generation)
- LLM + RAG = **Content extraction** (uses existing RAG tools)
- Frontend = **Visualization rendering** (React components)

## Architecture Flow

```
User asks: "What is the main gear brake assembly MOS?"
    ↓
[1] Frontend → Dashboard MCP: create_dashboard_query
    Input: { question, tileType: "counter" }
    Output: { system_prompt, user_question, expected_format }
    ↓
[2] Frontend → LLM Service (with RAG tools)
    Prompt: system_prompt + user_question
    LLM uses RAG tools to read documents and extract answer
    Output: "0.24"
    ↓
[3] Frontend → Dashboard MCP: format_llm_response
    Input: { llmResponse: "0.24", expectedFormat: "single_number", tileType: "counter" }
    Output: { type: "counter", value: 0.24, label: "", subtitle: "" }
    ↓
[4] Frontend renders CounterTile component
    Displays: 0.24
```

## Components

### 1. Dashboard MCP Server (Prompt Manager)
**Location**: `mcp-servers/workbook-dashboard/server.py`

**Responsibilities**:
- Manages prompt templates for each tile type
- Formats LLM responses for visualization
- **DOES NOT** read files
- **DOES NOT** couple with other MCP servers
- **DOES NOT** generate code

**Tools**:
- `create_dashboard_query` - Returns system prompt + expected format
- `format_llm_response` - Parses LLM response into visualization data

### 2. LLM Service (with RAG)
**Location**: `electron/services/llmService.ts`

**Responsibilities**:
- Receives structured prompts from Dashboard MCP
- Uses RAG tools to read document content
- Extracts specific values (MOS, dates, budget numbers)
- Returns answers in requested format

**Already has RAG tools available!** No changes needed.

### 3. Frontend (Tile Renderer)
**Location**: `src/components/Dashboard/*`

**Responsibilities**:
- Orchestrates the 3-step flow
- Renders visualization components
- Stores tile configurations

## Tile Types & Prompts

### Counter Tile
```python
System Prompt: "Return ONLY a single number. No units, no explanation."
Question: "What is the main gear brake assembly MOS?"
LLM Response: "0.24"
Formatted: { type: "counter", value: 0.24 }
```

### Counter Warning Tile
```python
System Prompt: "Count items matching warning criteria. Return count as number."
Question: "How many NDAs are expiring within 90 days?"
LLM Response: "2"
Formatted: { type: "counter_warning", value: 2, level: "warning" }
```

### Graph Tile
```python
System Prompt: "Return JSON: {labels: [...], values: [...]}"
Question: "Show document types breakdown"
LLM Response: {"labels": ["PDF", "MD", "CSV"], "values": [0, 11, 1]}
Formatted: { type: "graph", chartType: "bar", data: {...} }
```

### Table Tile
```python
System Prompt: "Return JSON array of objects (table rows)"
Question: "List all tests due soon"
LLM Response: [{"test": "Main Gear", "days": 45}, ...]
Formatted: { type: "table", columns: [...], rows: [...] }
```

### Text Tile
```python
System Prompt: "Provide brief summary with markdown formatting"
Question: "Summarize budget status"
LLM Response: "**Budget**: 3.4% over at $3,515,000..."
Formatted: { type: "text", content: "...", format: "markdown" }
```

## Benefits

✅ **Decoupled**: MCP servers don't know about each other
✅ **Simple**: Each component has one job
✅ **Scalable**: As RAG improves, dashboard automatically improves
✅ **Testable**: Can test each step independently
✅ **Maintainable**: Clear separation of concerns

## Example End-to-End

**Question**: "What is the manufacturing budget variance?"

**Step 1**: Create Query
```javascript
{
  system_prompt: "Return ONLY a single number...",
  user_question: "What is the manufacturing budget variance?",
  expected_format: "single_number"
}
```

**Step 2**: LLM + RAG
- LLM receives prompts
- Uses `read_workbook_file` RAG tool
- Reads `cost_tracking.md`
- Extracts: "-150000"

**Step 3**: Format Response
```javascript
{
  success: true,
  result: {
    type: "counter",
    value: -150000,
    label: "Manufacturing Variance",
    subtitle: "$150,000 over budget"
  }
}
```

**Step 4**: Render
```jsx
<CounterTile value={-150000} label="Manufacturing Variance" />
```

## Testing

Test the prompt manager:
```bash
node tests/test-prompt-manager.mjs
```

## Next Steps

1. ✅ Dashboard MCP Server implemented
2. ✅ Electron IPC updated
3. ✅ Frontend updated
4. ⏳ Test with real questions in UI
5. ⏳ Add more tile types as needed

## Migration from V1

V1 (code generation):
- Generated Python code
- Executed in subprocess
- Read files directly
- Coupled with RAG server

V2 (prompt manager):
- Manages prompts only
- No code execution
- Uses existing LLM+RAG
- Fully decoupled

**Old server backed up**: `server_old.py`
