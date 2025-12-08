# MCP Server Development Guide

## Table of Contents

1. [What Are MCP Servers?](#what-are-mcp-servers)
2. [Why MCP Servers Replace APIs](#why-mcp-servers-replace-apis)
3. [How MCP Servers Work](#how-mcp-servers-work)
4. [Building Your First MCP Server](#building-your-first-mcp-server)
5. [MCP Protocol Deep Dive](#mcp-protocol-deep-dive)
6. [Integration Patterns](#integration-patterns)
7. [Deterministic Calculation Server Example](#deterministic-calculation-server-example)
8. [Best Practices](#best-practices)
9. [Testing MCP Servers](#testing-mcp-servers)

---

## What Are MCP Servers?

**MCP (Model Context Protocol) servers** are standalone processes that provide **tools** to LLMs. Think of them as **specialized APIs** that the LLM can call directly.

### Key Concepts

- **MCP Server**: A separate process (Python, Node.js, etc.) that runs independently
- **Tools**: Functions the server exposes that the LLM can call
- **Protocol**: JSON-RPC over stdio (stdin/stdout)
- **Discovery**: Servers are auto-discovered from `mcp-servers/` directory

### Analogy: MCP Servers vs Traditional APIs

**Traditional API Approach:**

```
Frontend → Backend API → Database
         → External API → Third-party service
```

**MCP Server Approach:**

```
LLM → MCP Server (Python process) → Scilab/MATLAB
    → MCP Server (Python process) → File system
    → MCP Server (Python process) → Database
```

**Key Difference**: MCP servers are **LLM-native**. They're designed to be called by AI models, not by frontend code directly.

---

## Why MCP Servers Replace APIs

### 1. **LLM-Native Design**

Traditional REST APIs are designed for human developers. MCP servers are designed for AI:

- **Self-describing**: Tools include descriptions the LLM understands
- **Type-safe**: Input schemas prevent errors
- **Context-aware**: Can provide rich context to LLM
- **Tool calling**: LLMs can discover and call tools automatically

### 2. **Deterministic vs Probabilistic**

**Problem**: LLMs are probabilistic. They might calculate `4 × 4 = 16` correctly, but complex math is unreliable.

**Solution**: MCP servers provide deterministic calculations:

```python
# ❌ LLM calculating (unreliable)
User: "What is 4 × 4?"
LLM: "16"  # Might be wrong for complex calculations

# ✅ MCP server calculating (deterministic)
User: "What is 4 × 4?"
LLM → Calculation MCP: calculate(expression="4*4")
Calculation MCP → Scilab: Returns 16 (guaranteed correct)
LLM: "16"  # Always correct
```

### 3. **Separation of Concerns**

Each MCP server has a **single responsibility**:

- **workbook-rag**: Document search and reading
- **workbook-dashboard**: Dashboard query formatting
- **calculation-engine**: Deterministic math (Scilab/MATLAB)
- **workbook-manager**: Workbook CRUD operations

### 4. **Language Flexibility**

MCP servers can be written in **any language**:

- Python (most common) - Great for data processing, Scilab integration
- Node.js - If you need JavaScript libraries
- Go/Rust - For performance-critical servers
- Shell scripts - For simple operations

### 5. **Isolation and Reliability**

- **Crash isolation**: If one MCP server crashes, others keep running
- **Independent scaling**: Each server can be optimized separately
- **Easy debugging**: Logs are isolated per server
- **Versioning**: Update servers independently

---

## How MCP Servers Work

### Architecture Overview

```
┌─────────────────┐
│  Electron App   │
│  (Main Process)  │
└────────┬─────────┘
         │
         │ Spawns & manages
         │
    ┌────┴──────────────────────────────┐
    │                                    │
    ▼                                    ▼
┌──────────────┐              ┌──────────────────┐
│ MCP Service  │              │   LLM Service     │
│ (TypeScript) │              │   (TypeScript)    │
└──────┬───────┘              └─────────┬─────────┘
       │                                │
       │ IPC (sendRequest)              │ Tool calls
       │                                │
       ▼                                ▼
┌──────────────┐              ┌──────────────────┐
│ Python MCP   │              │  OpenAI/Claude   │
│ Server       │              │  (via API)        │
│ (subprocess) │              └──────────────────┘
└──────────────┘
```

### Communication Flow

**1. Server Discovery**

```
App Startup
    ↓
MCPService.discoverServers()
    ↓
Scans mcp-servers/ directory
    ↓
Reads config.json from each server
    ↓
Starts enabled servers as subprocesses
```

**2. Tool Registration**

```
MCP Server starts
    ↓
Sends initialization message (JSON-RPC)
    ↓
Declares available tools with schemas
    ↓
MCPService stores tool definitions
```

**3. Tool Execution**

```
LLM decides to use a tool
    ↓
LLM Service calls executeTool()
    ↓
MCPService.sendRequest(serverName, "tools/call", {...})
    ↓
Writes JSON-RPC request to server stdin
    ↓
Server processes request
    ↓
Server writes JSON-RPC response to stdout
    ↓
MCPService parses response
    ↓
Returns result to LLM Service
    ↓
LLM incorporates result into response
```

### Protocol: JSON-RPC over stdio

**Request Format:**

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "param1": "value1",
      "param2": 123
    }
  },
  "id": 1
}
```

**Response Format:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true,
    "data": {...}
  }
}
```

**Error Format:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Error description"
  }
}
```

---

## Building Your First MCP Server

### Step 1: Create Server Directory

```bash
mkdir -p mcp-servers/my-server
cd mcp-servers/my-server
```

### Step 2: Create config.json

```json
{
  "name": "my-server",
  "description": "My first MCP server",
  "command": "python",
  "args": ["server.py"],
  "enabled": true,
  "env": {
    "MY_VAR": "value"
  }
}
```

**Fields:**

- `name`: Unique identifier (used in code)
- `description`: Human-readable description
- `command`: Executable (python, node, etc.)
- `args`: Arguments (usually `["server.py"]`)
- `enabled`: Whether to start on app launch
- `env`: Environment variables (optional)

### Step 3: Create server.py

```python
#!/usr/bin/env python3
"""
My First MCP Server
"""
import json
import sys
from typing import Dict, Any

def handle_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Route tool calls to appropriate handlers"""
    handlers = {
        "greet": handle_greet,
        "calculate": handle_calculate,
    }

    handler = handlers.get(tool_name)
    if not handler:
        return {"error": f"Unknown tool: {tool_name}"}

    return handler(arguments)

def handle_greet(args: Dict[str, Any]) -> Dict[str, Any]:
    """Greet someone"""
    name = args.get("name", "World")
    return {
        "success": True,
        "message": f"Hello, {name}!"
    }

def handle_calculate(args: Dict[str, Any]) -> Dict[str, Any]:
    """Perform a calculation"""
    expression = args.get("expression", "")
    try:
        result = eval(expression)  # ⚠️ Insecure! Use safe eval in production
        return {
            "success": True,
            "result": result,
            "expression": expression
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    """Main MCP server loop"""

    # Define available tools
    tools = [
        {
            "name": "greet",
            "description": "Greet someone by name",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of the person to greet"
                    }
                },
                "required": ["name"]
            }
        },
        {
            "name": "calculate",
            "description": "Evaluate a mathematical expression",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Mathematical expression (e.g., '2 + 2')"
                    }
                },
                "required": ["expression"]
            }
        }
    ]

    # Send initialization message
    init_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "0.1.0",
            "serverInfo": {
                "name": "my-server",
                "version": "1.0.0"
            },
            "capabilities": {
                "tools": tools
            }
        }
    }

    print(json.dumps(init_response), flush=True)

    # Handle requests from stdin
    for line in sys.stdin:
        try:
            request = json.loads(line)
            method = request.get("method")

            if method == "tools/call":
                params = request.get("params", {})
                tool_name = params.get("name")
                arguments = params.get("arguments", {})

                result = handle_tool_call(tool_name, arguments)

                response = {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": result
                }
                print(json.dumps(response), flush=True)

        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": request.get("id") if "request" in locals() else None,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }
            print(json.dumps(error_response), flush=True)

if __name__ == "__main__":
    main()
```

### Step 4: Create requirements.txt (if needed)

```txt
# No dependencies for this simple example
```

### Step 5: Test Your Server

```bash
# Test manually
python server.py
# Then type: {"method": "tools/call", "params": {"name": "greet", "arguments": {"name": "Alice"}}}

# Or use the app - restart Insight LM and your server will be discovered
```

---

## MCP Protocol Deep Dive

### Initialization Message

**When**: Sent immediately when server starts
**Purpose**: Declare server capabilities

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "0.1.0",
    "serverInfo": {
      "name": "server-name",
      "version": "1.0.0"
    },
    "capabilities": {
      "tools": [
        {
          "name": "tool_name",
          "description": "What this tool does",
          "inputSchema": {
            "type": "object",
            "properties": {
              "param1": {
                "type": "string",
                "description": "Parameter description"
              }
            },
            "required": ["param1"]
          }
        }
      ]
    }
  }
}
```

### Tool Call Request

**Format:**

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "param1": "value1",
      "param2": 123
    }
  },
  "id": 2
}
```

**Processing:**

1. Parse JSON from stdin
2. Extract `method`, `params.name`, `params.arguments`
3. Route to handler function
4. Execute handler
5. Return result

### Tool Call Response

**Success:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "success": true,
    "data": {...}
  }
}
```

**Error:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32603,
    "message": "Error description"
  }
}
```

### Important Notes

- **Always flush stdout**: Use `flush=True` in Python `print()`
- **One request per line**: Each JSON object on its own line
- **Sequential processing**: Process requests one at a time
- **Error handling**: Always return valid JSON, even on errors

---

## Integration Patterns

### Pattern 1: Direct LLM Tool

**Use case**: LLM needs to call the server directly

**Flow:**

```
User Question
    ↓
LLM Service (with tool definitions)
    ↓
LLM decides to use tool
    ↓
LLM Service → MCPService.sendRequest()
    ↓
MCP Server processes request
    ↓
Result returned to LLM
    ↓
LLM incorporates result into answer
```

**Example**: Calculation server

```typescript
// LLM Service registers tool
{
  name: "calculate_expression",
  description: "Evaluate mathematical expression using Scilab",
  parameters: {
    expression: { type: "string" }
  }
}

// LLM calls it
User: "What is 4 × 4?"
LLM → calculate_expression({ expression: "4*4" })
Result: 16
LLM: "4 × 4 equals 16"
```

### Pattern 2: Pre-processing Pipeline

**Use case**: Another MCP server needs calculation results before calling LLM

**Flow:**

```
User Question
    ↓
Dashboard MCP receives question
    ↓
Dashboard MCP → Calculation MCP: "Calculate dates"
    ↓
Calculation MCP returns results
    ↓
Dashboard MCP → LLM: "Given these dates [45, 85, 125], answer question"
    ↓
LLM responds with formatted answer
```

**Example**: Dashboard with date calculations

```python
# Dashboard MCP server
def handle_dashboard_query(args):
    question = args["question"]

    # Pre-process: Calculate dates
    dates_result = call_calculation_mcp("calculate_days_between", {
        "date1": "2024-01-01",
        "date2": "2024-12-31"
    })

    # Call LLM with calculated data
    llm_prompt = f"Given these days: {dates_result['days']}, {question}"
    llm_response = call_llm(llm_prompt)

    return format_response(llm_response)
```

### Pattern 3: Chain of Servers

**Use case**: Multiple servers work together

**Flow:**

```
User Question
    ↓
LLM → RAG Server: "Search for documents"
    ↓
RAG Server returns document content
    ↓
LLM → Calculation Server: "Extract numbers and calculate"
    ↓
Calculation Server returns results
    ↓
LLM synthesizes final answer
```

### Pattern 4: Server-to-Server Communication

**Current limitation**: MCP servers can't directly call each other
**Workaround**: Use MCPService as intermediary

```python
# Server A needs to call Server B
# This requires MCPService to expose IPC endpoint
# (Not currently implemented, but possible)
```

---

## Deterministic Calculation Server Example

### Use Case

You want **guaranteed accurate calculations** using Scilab/MATLAB instead of relying on LLM math.

### Architecture

```
┌─────────────┐
│    LLM      │
└──────┬──────┘
       │ Tool call
       ▼
┌──────────────────┐
│ Calculation MCP   │
│   (Python)       │
└──────┬───────────┘
       │ Execute
       ▼
┌─────────────┐
│   Scilab    │
│  (Process)  │
└─────────────┘
```

### Implementation

**Directory Structure:**

```
mcp-servers/
  calculation-engine/
    server.py              # MCP server
    scilab_wrapper.py      # Scilab integration
    calculations/          # Pre-built calculation modules
      dates.sci
      mos.sci
      structural.sci
    config.json
    requirements.txt
    README.md
```

**config.json:**

```json
{
  "name": "calculation-engine",
  "description": "Deterministic calculations using Scilab",
  "command": "python",
  "args": ["server.py"],
  "enabled": true,
  "env": {
    "SCILAB_PATH": "C:/Program Files/scilab-2024.0.0/bin/scilab.exe"
  }
}
```

**server.py:**

```python
#!/usr/bin/env python3
"""
Deterministic Calculation MCP Server
Uses Scilab for guaranteed accurate calculations
"""
import json
import sys
import subprocess
import os
from typing import Dict, Any
from datetime import datetime
from pathlib import Path

# Scilab wrapper
def execute_scilab(code: str) -> Dict[str, Any]:
    """Execute Scilab code and return result"""
    scilab_path = os.environ.get("SCILAB_PATH", "scilab")

    # Create temporary script
    script_content = f"""
{code}
disp('RESULT:' + string(result))
"""

    temp_script = Path("/tmp/scilab_temp.sce")
    temp_script.write_text(script_content)

    try:
        # Run Scilab non-interactively
        result = subprocess.run(
            [scilab_path, "-nw", "-f", str(temp_script)],
            capture_output=True,
            text=True,
            timeout=30
        )

        # Parse output
        output = result.stdout
        if "RESULT:" in output:
            result_line = [l for l in output.split("\n") if "RESULT:" in l][0]
            result_value = result_line.split("RESULT:")[1].strip()
            return {"success": True, "result": result_value}
        else:
            return {"success": False, "error": result.stderr}

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if temp_script.exists():
            temp_script.unlink()

def calculate_days_between(args: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate days between two dates (deterministic)"""
    date1_str = args.get("date1")
    date2_str = args.get("date2")

    try:
        date1 = datetime.fromisoformat(date1_str)
        date2 = datetime.fromisoformat(date2_str)
        delta = (date2 - date1).days

        return {
            "success": True,
            "days": abs(delta),
            "direction": "future" if delta > 0 else "past",
            "exact": True  # Flag indicating deterministic result
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def evaluate_mos(args: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate Margin of Safety against thresholds"""
    mos_value = args.get("mos_value")
    min_threshold = args.get("min_threshold", 0.15)
    preferred_threshold = args.get("preferred_threshold", 0.25)

    if mos_value < min_threshold:
        status = "FAIL"
        color = "red"
    elif mos_value < preferred_threshold:
        status = "MARGINAL"
        color = "yellow"
    else:
        status = "PASS"
        color = "green"

    return {
        "success": True,
        "mos": mos_value,
        "status": status,
        "color": color,
        "meets_minimum": mos_value >= min_threshold,
        "meets_preferred": mos_value >= preferred_threshold,
        "exact": True
    }

def solve_expression(args: Dict[str, Any]) -> Dict[str, Any]:
    """Solve mathematical expression using Scilab"""
    expression = args.get("expression")

    # Convert expression to Scilab syntax
    # Example: "4*4" → "result = 4*4"
    scilab_code = f"result = {expression}"

    return execute_scilab(scilab_code)

def structural_analysis(args: Dict[str, Any]) -> Dict[str, Any]:
    """Perform structural calculations"""
    load = args.get("load")
    area = args.get("area")
    material = args.get("material", "7075-T6")

    # Material properties (simplified)
    material_props = {
        "7075-T6": {"allowable_stress": 60000, "yield": 73000},
        "6061-T6": {"allowable_stress": 40000, "yield": 40000},
    }

    props = material_props.get(material, material_props["7075-T6"])

    # Calculate stress
    stress = load / area

    # Calculate MOS
    mos = (props["allowable_stress"] - stress) / stress

    status = "PASS" if mos >= 0.15 else "FAIL"

    return {
        "success": True,
        "stress": stress,
        "allowable": props["allowable_stress"],
        "mos": mos,
        "status": status,
        "exact": True
    }

def handle_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Route tool calls to appropriate handlers"""
    handlers = {
        "calculate_days_between": calculate_days_between,
        "evaluate_mos": evaluate_mos,
        "solve_expression": solve_expression,
        "structural_analysis": structural_analysis,
    }

    handler = handlers.get(tool_name)
    if not handler:
        return {"success": False, "error": f"Unknown tool: {tool_name}"}

    try:
        return handler(arguments)
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    """Main MCP server loop"""

    tools = [
        {
            "name": "calculate_days_between",
            "description": "Calculate days between two dates (deterministic)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "date1": {"type": "string", "description": "First date (ISO format)"},
                    "date2": {"type": "string", "description": "Second date (ISO format)"}
                },
                "required": ["date1", "date2"]
            }
        },
        {
            "name": "evaluate_mos",
            "description": "Evaluate Margin of Safety against thresholds",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "mos_value": {"type": "number", "description": "MOS value to evaluate"},
                    "min_threshold": {"type": "number", "description": "Minimum acceptable MOS"},
                    "preferred_threshold": {"type": "number", "description": "Preferred MOS"}
                },
                "required": ["mos_value"]
            }
        },
        {
            "name": "solve_expression",
            "description": "Solve mathematical expression using Scilab (deterministic)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string", "description": "Mathematical expression"}
                },
                "required": ["expression"]
            }
        },
        {
            "name": "structural_analysis",
            "description": "Perform structural stress analysis",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "load": {"type": "number", "description": "Applied load (lbs)"},
                    "area": {"type": "number", "description": "Cross-sectional area (in²)"},
                    "material": {"type": "string", "description": "Material type"}
                },
                "required": ["load", "area"]
            }
        }
    ]

    # Send initialization
    init_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "0.1.0",
            "serverInfo": {
                "name": "calculation-engine",
                "version": "1.0.0"
            },
            "capabilities": {
                "tools": tools
            }
        }
    }

    print(json.dumps(init_response), flush=True)

    # Handle requests
    for line in sys.stdin:
        try:
            request = json.loads(line)
            method = request.get("method")

            if method == "tools/call":
                params = request.get("params", {})
                tool_name = params.get("name")
                arguments = params.get("arguments", {})

                result = handle_tool_call(tool_name, arguments)

                response = {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": result
                }
                print(json.dumps(response), flush=True)

        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": request.get("id") if "request" in locals() else None,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }
            print(json.dumps(error_response), flush=True)

if __name__ == "__main__":
    main()
```

### Registering with LLM Service

**Add to `electron/services/llmService.ts`:**

```typescript
private getAvailableTools() {
  return [
    // ... existing tools ...
    {
      name: "solve_expression",
      description: "Solve mathematical expressions using Scilab (deterministic, always accurate)",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Mathematical expression (e.g., '4*4', 'sqrt(16)', 'sin(pi/2)')"
          }
        },
        required: ["expression"]
      }
    },
    {
      name: "evaluate_mos",
      description: "Evaluate Margin of Safety against thresholds (deterministic)",
      parameters: {
        type: "object",
        properties: {
          mos_value: { type: "number" },
          min_threshold: { type: "number" },
          preferred_threshold: { type: "number" }
        },
        required: ["mos_value"]
      }
    }
  ];
}

private async executeTool(toolName: string, args: Record<string, any>): Promise<string> {
  switch (toolName) {
    // ... existing cases ...

    case "solve_expression":
    case "evaluate_mos":
    case "calculate_days_between":
    case "structural_analysis":
      try {
        const result = await this.mcpService.sendRequest(
          "calculation-engine",
          "tools/call",
          {
            name: toolName,
            arguments: args
          }
        );
        return JSON.stringify(result);
      } catch (error) {
        return `Error: ${error}`;
      }
  }
}
```

---

## Best Practices

### 1. **Tool Naming**

- **Use descriptive names**: `calculate_days_between` not `calc`
- **Use snake_case**: Consistent with Python conventions
- **Be specific**: `evaluate_mos` not `evaluate`

### 2. **Error Handling**

**Always return structured errors:**

```python
try:
    result = do_calculation()
    return {"success": True, "result": result}
except ValueError as e:
    return {"success": False, "error": f"Invalid input: {e}"}
except Exception as e:
    return {"success": False, "error": str(e)}
```

### 3. **Input Validation**

**Validate inputs before processing:**

```python
def handle_calculate(args):
    expression = args.get("expression")
    if not expression:
        return {"success": False, "error": "expression is required"}

    # Validate expression is safe
    if not re.match(r'^[0-9+\-*/().\s]+$', expression):
        return {"success": False, "error": "Invalid expression"}

    # ... process ...
```

### 4. **Logging**

**Log important events (to stderr):**

```python
import sys

print("Calculation server starting...", file=sys.stderr)
print(f"Processing: {expression}", file=sys.stderr)
```

### 5. **Performance**

- **Cache results**: If calculations are expensive
- **Timeout long operations**: Use timeouts for external calls
- **Batch operations**: Process multiple items at once when possible

### 6. **Documentation**

**Include in tool description:**

- What the tool does
- When to use it
- Example inputs/outputs
- Any limitations

```python
{
    "name": "solve_expression",
    "description": "Solve mathematical expression using Scilab. Use this for complex math that requires guaranteed accuracy. Examples: '4*4', 'sqrt(16)', 'sin(pi/2)'. Limitations: Only supports basic math operations."
}
```

---

## Testing MCP Servers

### Manual Testing

**1. Start server directly:**

```bash
cd mcp-servers/my-server
python server.py
```

**2. Send test request:**

```json
{
  "method": "tools/call",
  "params": { "name": "greet", "arguments": { "name": "Alice" } },
  "id": 1
}
```

**3. Check response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { "success": true, "message": "Hello, Alice!" }
}
```

### Automated Testing

**Create test file: `tests/test_my_server.py`:**

```python
import subprocess
import json
import sys

def test_server():
    proc = subprocess.Popen(
        ["python", "server.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    # Read initialization
    init_line = proc.stdout.readline()
    init_response = json.loads(init_line)
    assert init_response["result"]["serverInfo"]["name"] == "my-server"

    # Send test request
    request = {
        "method": "tools/call",
        "params": {
            "name": "greet",
            "arguments": {"name": "Alice"}
        },
        "id": 1
    }
    proc.stdin.write(json.dumps(request) + "\n")
    proc.stdin.flush()

    # Read response
    response_line = proc.stdout.readline()
    response = json.loads(response_line)
    assert response["result"]["success"] == True
    assert "Alice" in response["result"]["message"]

    proc.terminate()
    print("✅ All tests passed!")

if __name__ == "__main__":
    test_server()
```

### Integration Testing

**Test from Electron app:**

```typescript
// In electron/main.ts or test file
const result = await mcpService.sendRequest("my-server", "tools/call", {
  name: "greet",
  arguments: { name: "Alice" },
});
console.assert(result.success === true);
```

---

## Summary

**MCP servers are:**

- ✅ LLM-native APIs (designed for AI, not humans)
- ✅ Deterministic calculation engines (Scilab, MATLAB)
- ✅ Isolated processes (crash-safe, independent)
- ✅ Language-agnostic (Python, Node.js, etc.)
- ✅ Self-describing (tools include schemas)

**Use MCP servers when:**

- You need **deterministic calculations** (math, dates, engineering)
- You want to **offload work** from LLM (file processing, database queries)
- You need **specialized tools** (Scilab, image processing, etc.)
- You want **isolation** (one server crash doesn't affect others)

**Next steps:**

1. Build your first MCP server (start simple)
2. Test it manually and with the app
3. Add more tools as needed
4. Consider deterministic calculation server for math-heavy workflows






