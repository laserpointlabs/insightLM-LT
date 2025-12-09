# MCP Server Examples and Templates

Practical, copy-paste examples for building MCP servers.

## Table of Contents

1. [Minimal MCP Server Template](#minimal-mcp-server-template)
2. [Deterministic Calculation Server](#deterministic-calculation-server)
3. [File Processing Server](#file-processing-server)
4. [Database Query Server](#database-query-server)
5. [External API Wrapper](#external-api-wrapper)

---

## Minimal MCP Server Template

**Use this as a starting point for any new MCP server.**

### Directory Structure
```
mcp-servers/my-server/
├── config.json
├── server.py
├── requirements.txt
└── README.md
```

### config.json
```json
{
  "name": "my-server",
  "description": "Description of what this server does",
  "command": "python",
  "args": ["server.py"],
  "enabled": true
}
```

### server.py
```python
#!/usr/bin/env python3
"""
My MCP Server - Template
"""
import json
import sys
from typing import Dict, Any

def handle_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Route tool calls to appropriate handlers"""
    handlers = {
        "my_tool": handle_my_tool,
    }

    handler = handlers.get(tool_name)
    if not handler:
        return {"success": False, "error": f"Unknown tool: {tool_name}"}

    try:
        return handler(arguments)
    except Exception as e:
        return {"success": False, "error": str(e)}

def handle_my_tool(args: Dict[str, Any]) -> Dict[str, Any]:
    """Tool implementation"""
    param1 = args.get("param1")

    # Your logic here
    result = f"Processed: {param1}"

    return {
        "success": True,
        "result": result
    }

def main():
    """Main MCP server loop"""

    tools = [
        {
            "name": "my_tool",
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

    # Send initialization
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

### requirements.txt
```txt
# Add your dependencies here
```

---

## Deterministic Calculation Server

**Complete implementation for Scilab/MATLAB-based calculations.**

### Directory Structure
```
mcp-servers/calculation-engine/
├── config.json
├── server.py
├── scilab_wrapper.py
├── calculations/
│   ├── dates.py
│   ├── mos.py
│   └── structural.py
├── requirements.txt
└── README.md
```

### config.json
```json
{
  "name": "calculation-engine",
  "description": "Deterministic calculations using Scilab/MATLAB",
  "command": "python",
  "args": ["server.py"],
  "enabled": true,
  "env": {
    "SCILAB_PATH": "${SCILAB_PATH}"
  }
}
```

### server.py
```python
#!/usr/bin/env python3
"""
Deterministic Calculation MCP Server
Provides guaranteed accurate calculations using Scilab
"""
import json
import sys
from typing import Dict, Any
from datetime import datetime
from calculations.dates import calculate_days_between, calculate_workdays
from calculations.mos import evaluate_mos, evaluate_mos_batch
from calculations.structural import structural_analysis, stress_analysis
from scilab_wrapper import execute_scilab

def handle_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Route tool calls to appropriate handlers"""
    handlers = {
        # Date calculations
        "calculate_days_between": calculate_days_between,
        "calculate_workdays": calculate_workdays,

        # MOS evaluations
        "evaluate_mos": evaluate_mos,
        "evaluate_mos_batch": evaluate_mos_batch,

        # Structural analysis
        "structural_analysis": structural_analysis,
        "stress_analysis": stress_analysis,

        # General Scilab execution
        "execute_scilab": execute_scilab,
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
            "description": "Calculate days between two dates (deterministic, always accurate)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "date1": {
                        "type": "string",
                        "description": "First date in ISO format (YYYY-MM-DD)"
                    },
                    "date2": {
                        "type": "string",
                        "description": "Second date in ISO format (YYYY-MM-DD)"
                    }
                },
                "required": ["date1", "date2"]
            }
        },
        {
            "name": "evaluate_mos",
            "description": "Evaluate Margin of Safety against thresholds (deterministic)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "mos_value": {
                        "type": "number",
                        "description": "MOS value to evaluate"
                    },
                    "min_threshold": {
                        "type": "number",
                        "description": "Minimum acceptable MOS (default: 0.15)"
                    },
                    "preferred_threshold": {
                        "type": "number",
                        "description": "Preferred MOS (default: 0.25)"
                    }
                },
                "required": ["mos_value"]
            }
        },
        {
            "name": "solve_expression",
            "description": "Solve mathematical expression using Scilab (deterministic, always accurate). Use for complex math, matrix operations, ODEs, etc.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Mathematical expression in Scilab syntax (e.g., '4*4', 'sqrt(16)', 'sin(%pi/2)', 'A*B' for matrices)"
                    }
                },
                "required": ["expression"]
            }
        },
        {
            "name": "structural_analysis",
            "description": "Perform structural stress analysis (deterministic)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "load": {
                        "type": "number",
                        "description": "Applied load (lbs)"
                    },
                    "area": {
                        "type": "number",
                        "description": "Cross-sectional area (in²)"
                    },
                    "material": {
                        "type": "string",
                        "description": "Material type (e.g., '7075-T6', '6061-T6')"
                    }
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

### calculations/dates.py
```python
"""Date calculation functions"""
from datetime import datetime, timedelta
from typing import Dict, Any

def calculate_days_between(args: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate days between two dates (deterministic)"""
    date1_str = args.get("date1")
    date2_str = args.get("date2")

    try:
        date1 = datetime.fromisoformat(date1_str)
        date2 = datetime.fromisoformat(date2_str)
        delta = date2 - date1

        return {
            "success": True,
            "days": abs(delta.days),
            "direction": "future" if delta.days > 0 else "past",
            "exact": True  # Flag indicating deterministic result
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def calculate_workdays(args: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate workdays between two dates (excludes weekends)"""
    date1_str = args.get("date1")
    date2_str = args.get("date2")

    try:
        date1 = datetime.fromisoformat(date1_str)
        date2 = datetime.fromisoformat(date2_str)

        workdays = 0
        current = date1
        while current <= date2:
            # Monday = 0, Sunday = 6
            if current.weekday() < 5:  # Monday-Friday
                workdays += 1
            current += timedelta(days=1)

        return {
            "success": True,
            "workdays": workdays,
            "total_days": (date2 - date1).days + 1,
            "exact": True
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### calculations/mos.py
```python
"""Margin of Safety evaluation functions"""
from typing import Dict, Any, List

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

def evaluate_mos_batch(args: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate multiple MOS values"""
    mos_values = args.get("mos_values", [])
    min_threshold = args.get("min_threshold", 0.15)
    preferred_threshold = args.get("preferred_threshold", 0.25)

    results = []
    for mos_value in mos_values:
        result = evaluate_mos({
            "mos_value": mos_value,
            "min_threshold": min_threshold,
            "preferred_threshold": preferred_threshold
        })
        results.append(result)

    # Count statuses
    status_counts = {"PASS": 0, "MARGINAL": 0, "FAIL": 0}
    for result in results:
        status_counts[result["status"]] += 1

    return {
        "success": True,
        "results": results,
        "summary": {
            "total": len(results),
            "pass": status_counts["PASS"],
            "marginal": status_counts["MARGINAL"],
            "fail": status_counts["FAIL"]
        },
        "exact": True
    }
```

### calculations/structural.py
```python
"""Structural analysis functions"""
from typing import Dict, Any

# Material properties database
MATERIAL_PROPERTIES = {
    "7075-T6": {
        "allowable_stress": 60000,  # psi
        "yield_strength": 73000,
        "ultimate_strength": 83000,
        "density": 0.101  # lb/in³
    },
    "6061-T6": {
        "allowable_stress": 40000,
        "yield_strength": 40000,
        "ultimate_strength": 45000,
        "density": 0.098
    },
    "2024-T3": {
        "allowable_stress": 47000,
        "yield_strength": 47000,
        "ultimate_strength": 70000,
        "density": 0.101
    }
}

def structural_analysis(args: Dict[str, Any]) -> Dict[str, Any]:
    """Perform structural stress analysis"""
    load = args.get("load")
    area = args.get("area")
    material = args.get("material", "7075-T6")

    props = MATERIAL_PROPERTIES.get(material, MATERIAL_PROPERTIES["7075-T6"])

    # Calculate stress
    stress = load / area

    # Calculate MOS
    mos = (props["allowable_stress"] - stress) / stress

    status = "PASS" if mos >= 0.15 else "FAIL"

    return {
        "success": True,
        "stress": round(stress, 2),
        "allowable": props["allowable_stress"],
        "mos": round(mos, 4),
        "status": status,
        "material": material,
        "exact": True
    }

def stress_analysis(args: Dict[str, Any]) -> Dict[str, Any]:
    """More detailed stress analysis with multiple load cases"""
    loads = args.get("loads", [])
    area = args.get("area")
    material = args.get("material", "7075-T6")

    props = MATERIAL_PROPERTIES.get(material, MATERIAL_PROPERTIES["7075-T6"])

    results = []
    for load in loads:
        stress = load / area
        mos = (props["allowable_stress"] - stress) / stress
        status = "PASS" if mos >= 0.15 else "FAIL"

        results.append({
            "load": load,
            "stress": round(stress, 2),
            "mos": round(mos, 4),
            "status": status
        })

    # Find worst case
    worst_case = min(results, key=lambda x: x["mos"])

    return {
        "success": True,
        "results": results,
        "worst_case": worst_case,
        "allowable": props["allowable_stress"],
        "exact": True
    }
```

### scilab_wrapper.py
```python
"""Scilab execution wrapper"""
import subprocess
import os
import tempfile
from pathlib import Path
from typing import Dict, Any

def execute_scilab(args: Dict[str, Any]) -> Dict[str, Any]:
    """Execute Scilab code and return result"""
    code = args.get("code") or args.get("expression", "")

    if not code:
        return {"success": False, "error": "No code provided"}

    scilab_path = os.environ.get("SCILAB_PATH", "scilab")

    # Create temporary script
    script_content = f"""
// Scilab script
{code}
// Output result
if exists('result') then
    disp('RESULT:' + string(result))
else
    disp('RESULT:No result variable')
end
"""

    # Use temporary file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sce', delete=False) as f:
        f.write(script_content)
        temp_script = f.name

    try:
        # Run Scilab non-interactively
        result = subprocess.run(
            [scilab_path, "-nw", "-f", temp_script],
            capture_output=True,
            text=True,
            timeout=30
        )

        # Parse output
        output = result.stdout
        if "RESULT:" in output:
            result_line = [l for l in output.split("\n") if "RESULT:" in l][0]
            result_value = result_line.split("RESULT:")[1].strip()
            return {
                "success": True,
                "result": result_value,
                "exact": True
            }
        else:
            return {
                "success": False,
                "error": result.stderr or "No result found",
                "stdout": output
            }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Scilab execution timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        # Clean up
        if os.path.exists(temp_script):
            os.unlink(temp_script)
```

### requirements.txt
```txt
# No external dependencies required for basic calculations
# Scilab must be installed separately
```

---

## File Processing Server

**Example: Process files (images, documents, etc.)**

### server.py (excerpt)
```python
from PIL import Image
import pandas as pd

def process_image(args: Dict[str, Any]) -> Dict[str, Any]:
    """Process an image file"""
    file_path = args.get("file_path")
    operation = args.get("operation", "info")

    try:
        img = Image.open(file_path)

        if operation == "info":
            return {
                "success": True,
                "width": img.width,
                "height": img.height,
                "format": img.format,
                "mode": img.mode
            }
        elif operation == "resize":
            width = args.get("width")
            height = args.get("height")
            resized = img.resize((width, height))
            # Save or return...

    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## Database Query Server

**Example: Query databases**

### server.py (excerpt)
```python
import sqlite3

def query_database(args: Dict[str, Any]) -> Dict[str, Any]:
    """Execute SQL query"""
    db_path = args.get("db_path")
    query = args.get("query")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(query)

        if query.strip().upper().startswith("SELECT"):
            results = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            return {
                "success": True,
                "columns": columns,
                "rows": results
            }
        else:
            conn.commit()
            return {"success": True, "rows_affected": cursor.rowcount}

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        conn.close()
```

---

## External API Wrapper

**Example: Wrap external REST APIs**

### server.py (excerpt)
```python
import requests

def call_external_api(args: Dict[str, Any]) -> Dict[str, Any]:
    """Call external REST API"""
    url = args.get("url")
    method = args.get("method", "GET")
    headers = args.get("headers", {})
    data = args.get("data")

    try:
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=data,
            timeout=30
        )

        return {
            "success": True,
            "status_code": response.status_code,
            "data": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## Integration Checklist

When creating a new MCP server:

- [ ] Create directory in `mcp-servers/`
- [ ] Add `config.json` with server metadata
- [ ] Implement `server.py` with initialization and tool handlers
- [ ] Define tool schemas with descriptions
- [ ] Add error handling for all tools
- [ ] Test manually (run server.py directly)
- [ ] Test from Electron app (restart app, check discovery)
- [ ] Register tools with LLM Service (if needed)
- [ ] Add to `electron-builder.json` files list
- [ ] Document in README.md

---

## Common Patterns

### Pattern: Batch Processing
```python
def process_batch(args: Dict[str, Any]) -> Dict[str, Any]:
    items = args.get("items", [])
    results = []

    for item in items:
        result = process_item(item)
        results.append(result)

    return {"success": True, "results": results}
```

### Pattern: Caching
```python
_cache = {}

def cached_calculation(args: Dict[str, Any]) -> Dict[str, Any]:
    key = str(args)
    if key in _cache:
        return {"success": True, "result": _cache[key], "cached": True}

    result = expensive_calculation(args)
    _cache[key] = result
    return {"success": True, "result": result, "cached": False}
```

### Pattern: Validation
```python
def validate_and_process(args: Dict[str, Any]) -> Dict[str, Any]:
    # Validate inputs
    required = ["param1", "param2"]
    for field in required:
        if field not in args:
            return {"success": False, "error": f"Missing required field: {field}"}

    # Validate types
    if not isinstance(args["param1"], str):
        return {"success": False, "error": "param1 must be a string"}

    # Process
    return {"success": True, "result": process(args)}
```

---

## Next Steps

1. **Start with the minimal template**
2. **Add one tool at a time**
3. **Test each tool before adding the next**
4. **Use the calculation server as reference**
5. **Follow the patterns above**








