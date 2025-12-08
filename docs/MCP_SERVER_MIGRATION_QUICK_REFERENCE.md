# MCP Server Migration Quick Reference

Quick step-by-step guide for migrating a server to FastMCP.

## Pre-Migration Checklist

- [ ] Server is working in current state
- [ ] Tests exist (or create them)
- [ ] API contract is documented
- [ ] Backup current code

## Migration Steps

### 1. Install FastMCP

```bash
cd mcp-servers/your-server
pip install mcp>=1.0.0
```

Add to `requirements.txt`:
```txt
mcp>=1.0.0
```

### 2. Update Imports

**Before:**
```python
import json
import sys
from typing import Dict, Any
```

**After:**
```python
from mcp import FastMCP
from typing import Dict, Any
```

### 3. Replace Main Loop

**Before:**
```python
def main():
    tools = [
        {
            "name": "my_tool",
            "description": "...",
            "inputSchema": {...}
        }
    ]

    init_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "0.1.0",
            "serverInfo": {"name": "my-server", "version": "1.0.0"},
            "capabilities": {"tools": tools}
        }
    }
    print(json.dumps(init_response), flush=True)

    for line in sys.stdin:
        request = json.loads(line)
        if request.get("method") == "tools/call":
            # ... handle request ...
```

**After:**
```python
mcp = FastMCP("my-server")

@mcp.tool()
def my_tool(param1: str, param2: int = 0) -> dict:
    """
    Tool description.

    Args:
        param1: Description of param1
        param2: Description of param2 (default: 0)

    Returns:
        Dictionary with result
    """
    # Your existing handler logic
    return {"success": True, "result": ...}

if __name__ == "__main__":
    mcp.run()
```

### 4. Convert Tool Definitions

**Before (Manual Schema):**
```python
tools = [
    {
        "name": "calculate",
        "description": "Calculate something",
        "inputSchema": {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "Math expression"
                },
                "precision": {
                    "type": "number",
                    "description": "Decimal places"
                }
            },
            "required": ["expression"]
        }
    }
]
```

**After (FastMCP Decorator):**
```python
@mcp.tool()
def calculate(expression: str, precision: int = 2) -> dict:
    """
    Calculate something.

    Args:
        expression: Math expression
        precision: Decimal places (default: 2)

    Returns:
        Dictionary with calculation result
    """
    # Implementation
    return {"success": True, "result": ...}
```

### 5. Update Handler Functions

**Before:**
```python
def handle_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    if tool_name == "calculate":
        expression = arguments.get("expression")
        precision = arguments.get("precision", 2)
        return calculate(expression, precision)
```

**After:**
```python
@mcp.tool()
def calculate(expression: str, precision: int = 2) -> dict:
    # Direct implementation - no routing needed
    result = eval(expression)  # Your logic
    return {"success": True, "result": round(result, precision)}
```

### 6. Handle Errors

**Before:**
```python
try:
    result = do_something()
    return {"success": True, "result": result}
except Exception as e:
    return {"success": False, "error": str(e)}
```

**After:**
```python
@mcp.tool()
def my_tool(param: str) -> dict:
    try:
        result = do_something(param)
        return {"success": True, "result": result}
    except ValueError as e:
        # FastMCP will format this as proper JSON-RPC error
        raise ValueError(f"Invalid input: {e}")
    except Exception as e:
        raise RuntimeError(f"Processing failed: {e}")
```

### 7. Test

```bash
# Test manually
python server.py
# Send: {"method": "tools/call", "params": {"name": "calculate", "arguments": {"expression": "4*4"}}, "id": 1}

# Test from app
# Restart Insight LM and verify server is discovered
```

## Common Patterns

### Pattern 1: Keep Existing Handler Functions

If you have complex handler functions, keep them:

```python
@mcp.tool()
def my_tool(param1: str, param2: int) -> dict:
    """Tool description"""
    # Call existing handler
    return existing_handler_function({"param1": param1, "param2": param2})
```

### Pattern 2: Convert Methods to Tools

**Before (Method-based):**
```python
if method == 'rag/search':
    query = params.get('query')
    results = search_workbooks(query)
    return {'result': results}
```

**After (Tool-based):**
```python
@mcp.tool()
def search(query: str, limit: int = 20) -> dict:
    """Search for files across workbooks"""
    results = search_workbooks(query, limit)
    return {"result": results}
```

### Pattern 3: Optional Parameters

```python
@mcp.tool()
def search(query: str, limit: int = 20, include_content: bool = False) -> dict:
    """
    Search with optional parameters.

    Args:
        query: Search query
        limit: Maximum results (default: 20)
        include_content: Include file content (default: False)
    """
    # Implementation
```

### Pattern 4: Complex Return Types

```python
from typing import List, Dict

@mcp.tool()
def list_files() -> Dict[str, List[Dict[str, str]]]:
    """
    List all files.

    Returns:
        Dictionary with 'files' key containing list of file info
    """
    files = get_all_files()
    return {"files": files}
```

## Troubleshooting

### Issue: Server doesn't start

**Check:**
- FastMCP installed: `pip list | grep mcp`
- Python version: FastMCP requires Python 3.8+
- Import error: Check `from mcp import FastMCP`

### Issue: Tools not registered

**Check:**
- Decorator syntax: `@mcp.tool()` (not `@mcp.tool`)
- Function has docstring (required for description)
- Type hints are present

### Issue: Type errors

**Fix:**
- Add type hints: `def tool(param: str) -> dict:`
- Use proper types: `str`, `int`, `float`, `bool`, `dict`, `list`

### Issue: Electron app can't call tools

**Check:**
- Tool names match (case-sensitive)
- Parameter names match
- Return format is correct: `{"success": True, ...}`

## Migration Checklist

- [ ] FastMCP installed
- [ ] Imports updated
- [ ] Main loop replaced with `mcp.run()`
- [ ] Tools converted to `@mcp.tool()` decorators
- [ ] Type hints added
- [ ] Docstrings added
- [ ] Error handling updated
- [ ] Tests pass
- [ ] Works from Electron app
- [ ] Old code removed
- [ ] README updated

## Example: Complete Migration

**Before:**
```python
#!/usr/bin/env python3
import json
import sys

def handle_calculate(args):
    expression = args.get("expression")
    try:
        result = eval(expression)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    tools = [{
        "name": "calculate",
        "description": "Calculate expression",
        "inputSchema": {
            "type": "object",
            "properties": {
                "expression": {"type": "string"}
            },
            "required": ["expression"]
        }
    }]

    print(json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "0.1.0",
            "serverInfo": {"name": "calc-server", "version": "1.0.0"},
            "capabilities": {"tools": tools}
        }
    }), flush=True)

    for line in sys.stdin:
        request = json.loads(line)
        if request.get("method") == "tools/call":
            params = request["params"]
            result = handle_calculate(params["arguments"])
            print(json.dumps({
                "jsonrpc": "2.0",
                "id": request["id"],
                "result": result
            }), flush=True)

if __name__ == "__main__":
    main()
```

**After:**
```python
#!/usr/bin/env python3
from mcp import FastMCP

mcp = FastMCP("calc-server")

@mcp.tool()
def calculate(expression: str) -> dict:
    """
    Calculate mathematical expression.

    Args:
        expression: Mathematical expression to evaluate

    Returns:
        Dictionary with result or error
    """
    try:
        result = eval(expression)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    mcp.run()
```

**Code Reduction:** ~80% less code!

## Next Steps

1. Pick a server to migrate (start with simplest)
2. Follow steps above
3. Test thoroughly
4. Move to next server

See `docs/MCP_SERVER_MIGRATION_PLAN.md` for full migration plan.






