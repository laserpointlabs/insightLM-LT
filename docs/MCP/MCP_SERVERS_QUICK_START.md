# MCP Servers Quick Start

**5-minute guide to understanding and building MCP servers.**

## What Are MCP Servers?

**MCP servers = APIs for LLMs**

Instead of:

```
Frontend → REST API → Database
```

You have:

```
LLM → MCP Server (Python) → NumPy/SciPy/Database/etc.
```

**Key insight**: MCP servers are **designed for AI**, not humans. They provide **tools** that LLMs can discover and call automatically.

---

## Why Use MCP Servers?

### 1. **Deterministic Calculations**

**Problem**: LLMs are probabilistic. They might calculate `4 × 4 = 16` correctly, but complex math is unreliable.

**Solution**: MCP server uses Python/NumPy for guaranteed accuracy.

```
User: "What is 4 × 4?"
LLM → Calculation MCP → Python/NumPy: Returns 16 (always correct)
LLM: "16"
```

### 2. **Separation of Concerns**

Each server has one job:

- **workbook-rag**: Search documents
- **calculation-engine**: Do math (Python/NumPy)
- **workbook-dashboard**: Format dashboard queries

### 3. **Language Flexibility**

Write servers in **any language**:

- Python (most common)
- Node.js
- Shell scripts
- Go/Rust

---

## How They Work

### Architecture

```
Electron App (Main Process)
    ↓
MCPService (discovers & manages servers)
    ↓
Python MCP Server (subprocess)
    ↓
NumPy/SciPy (Python libraries)
```

### Communication

**JSON-RPC over stdio** (stdin/stdout):

**Request:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "solve_expression",
    "arguments": { "expression": "4*4" }
  }
}
```

**Response:**

```json
{
  "result": {
    "success": true,
    "result": "16"
  }
}
```

---

## Building Your First Server

### Step 1: Create Directory

```bash
mkdir mcp-servers/my-server
cd mcp-servers/my-server
```

### Step 2: Create config.json

```json
{
  "name": "my-server",
  "description": "My first MCP server",
  "command": "python",
  "args": ["server.py"],
  "enabled": true
}
```

### Step 3: Create server.py

**Option A: Using FastMCP (Recommended)**

```python
#!/usr/bin/env python3
from mcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def greet(name: str) -> str:
    """Greet someone by name"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run()
```

**Option B: Raw Implementation (For Learning)**

```python
#!/usr/bin/env python3
import json
import sys

def handle_tool(args):
    name = args.get("name", "World")
    return {"success": True, "message": f"Hello, {name}!"}

def main():
    # Send initialization
    print(json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "0.1.0",
            "serverInfo": {"name": "my-server", "version": "1.0.0"},
            "capabilities": {
                "tools": [{
                    "name": "greet",
                    "description": "Greet someone",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"}
                        },
                        "required": ["name"]
                    }
                }]
            }
        }
    }), flush=True)

    # Handle requests
    for line in sys.stdin:
        request = json.loads(line)
        if request.get("method") == "tools/call":
            params = request["params"]
            result = handle_tool(params["arguments"])
            print(json.dumps({
                "jsonrpc": "2.0",
                "id": request["id"],
                "result": result
            }), flush=True)

if __name__ == "__main__":
    main()
```

**Note**: FastMCP requires `pip install mcp`. See `docs/MCP_SERVER_FRAMEWORKS.md` for details.

### Step 4: Test

```bash
python server.py
# Type: {"method": "tools/call", "params": {"name": "greet", "arguments": {"name": "Alice"}}, "id": 1}
```

### Step 5: Use in App

Restart Insight LM → Server auto-discovers → Available to LLM

---

## Deterministic Calculation Server

**Your use case**: Use Scilab/MATLAB for math instead of LLM.

### Quick Implementation

**server.py** (using FastMCP + Python):

```python
#!/usr/bin/env python3
from mcp import FastMCP
import numpy as np

mcp = FastMCP("calculation-engine")

@mcp.tool()
def solve_expression(expression: str) -> dict:
    """
    Solve mathematical expression using Python/NumPy (deterministic).

    Examples: "4*4", "sqrt(16)", "sin(pi/2)"
    """
    try:
        result = float(np.eval(expression))
        return {"success": True, "result": result, "exact": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    mcp.run()
```

**requirements.txt:**

```txt
mcp>=1.0.0
numpy>=1.24.0
```

### Tools to Expose

1. **solve_expression**: Math using Scilab
2. **calculate_days_between**: Date arithmetic
3. **evaluate_mos**: Margin of Safety evaluation
4. **structural_analysis**: Engineering calculations

---

## Integration with LLM

### Register Tools

**In `electron/services/llmService.ts`:**

```typescript
private getAvailableTools() {
  return [
    // ... existing tools ...
    {
      name: "solve_expression",
      description: "Solve math using Python/NumPy (deterministic, always accurate)",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string" }
        },
        required: ["expression"]
      }
    }
  ];
}

private async executeTool(toolName: string, args: any) {
  switch (toolName) {
    case "solve_expression":
      return await this.mcpService.sendRequest(
        "calculation-engine",
        "tools/call",
        { name: "solve_expression", arguments: args }
      );
  }
}
```

### How LLM Uses It

```
User: "What is 4 × 4?"
    ↓
LLM sees solve_expression tool available
    ↓
LLM calls: solve_expression({expression: "4*4"})
    ↓
Calculation MCP → Python/NumPy: Returns 16
    ↓
LLM: "4 × 4 equals 16"
```

---

## Key Concepts

### 1. **Tool Schemas**

Describe what the tool does:

```python
{
    "name": "solve_expression",
    "description": "Solve math using Scilab",
    "inputSchema": {
        "type": "object",
        "properties": {
            "expression": {"type": "string"}
        },
        "required": ["expression"]
    }
}
```

### 2. **Error Handling**

Always return structured errors:

```python
try:
    result = do_calculation()
    return {"success": True, "result": result}
except Exception as e:
    return {"success": False, "error": str(e)}
```

### 3. **Deterministic Flag**

Mark deterministic results:

```python
return {
    "success": True,
    "result": 16,
    "exact": True  # LLM knows this is guaranteed accurate
}
```

---

## Common Patterns

### Pattern 1: Direct LLM Tool

```
User Question → LLM → MCP Server → Result → LLM Answer
```

### Pattern 2: Pre-processing

```
User Question → Dashboard MCP → Calculation MCP → LLM → Answer
```

### Pattern 3: Chain

```
User Question → LLM → RAG Server → Calculation Server → Answer
```

---

## File Structure

```
mcp-servers/
├── my-server/
│   ├── config.json      # Server metadata
│   ├── server.py        # Main server code
│   └── requirements.txt # Dependencies
├── calculation-engine/
│   ├── config.json
│   ├── server.py
│   ├── scilab_wrapper.py
│   └── calculations/
│       ├── dates.py
│       └── mos.py
└── workbook-rag/
    └── ...
```

---

## Checklist

When building a new MCP server:

- [ ] Create directory in `mcp-servers/`
- [ ] Add `config.json`
- [ ] Implement `server.py` with initialization
- [ ] Define tool schemas
- [ ] Add error handling
- [ ] Test manually
- [ ] Test from app
- [ ] Register with LLM Service (if needed)

---

## Resources

- **Full Guide**: `docs/MCP_SERVER_GUIDE.md`
- **Examples**: `docs/MCP_SERVER_EXAMPLES.md`
- **Frameworks**: `docs/MCP_SERVER_FRAMEWORKS.md` (FastMCP vs Raw, Python vs Scilab)
- **Existing Servers**: `mcp-servers/workbook-rag/`, `mcp-servers/workbook-dashboard/`

---

## Next Steps

1. **Read the full guide** (`MCP_SERVER_GUIDE.md`)
2. **Copy an example** (`MCP_SERVER_EXAMPLES.md`)
3. **Build your calculation server**
4. **Test it**
5. **Integrate with LLM**

---

## Quick Reference

**Initialize server:**

```python
print(json.dumps({
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "protocolVersion": "0.1.0",
        "serverInfo": {"name": "...", "version": "1.0.0"},
        "capabilities": {"tools": [...]}
    }
}), flush=True)
```

**Handle request:**

```python
request = json.loads(line)
if request["method"] == "tools/call":
    result = handle_tool(request["params"]["arguments"])
    print(json.dumps({
        "jsonrpc": "2.0",
        "id": request["id"],
        "result": result
    }), flush=True)
```

**Always flush stdout!**
