# MCP Server Frameworks: FastMCP vs Raw Implementation

## Should You Use FastMCP?

**Short answer: Yes, for most cases.**

FastMCP is a Python framework that simplifies building MCP servers. It handles all the JSON-RPC protocol boilerplate, so you can focus on your business logic.

### Comparison

**Raw Implementation (What We've Been Showing):**

```python
#!/usr/bin/env python3
import json
import sys
from typing import Dict, Any

def main():
    # Send initialization
    init_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "0.1.0",
            "serverInfo": {"name": "my-server", "version": "1.0.0"},
            "capabilities": {"tools": [...]}
        }
    }
    print(json.dumps(init_response), flush=True)

    # Handle requests
    for line in sys.stdin:
        request = json.loads(line)
        if request.get("method") == "tools/call":
            # ... handle tool call ...
            response = {"jsonrpc": "2.0", "id": request["id"], "result": result}
            print(json.dumps(response), flush=True)
```

**FastMCP Implementation:**

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

**Much cleaner!**

### Advantages of FastMCP

1. **Less Boilerplate**: No manual JSON-RPC handling
2. **Type Safety**: Uses Python type hints for validation
3. **Error Handling**: Automatic error formatting
4. **Async Support**: Built-in async/await support
5. **Tool Decorators**: Simple `@mcp.tool()` decorator
6. **Better Documentation**: Auto-generates tool schemas from docstrings

### When to Use Raw Implementation

- **Learning**: Understanding the protocol is valuable
- **Minimal Dependencies**: Don't want to add FastMCP dependency
- **Custom Protocol**: Need to modify protocol behavior
- **Non-Python**: FastMCP is Python-only

### Recommendation

**Use FastMCP** for new servers. It's:

- ✅ Well-maintained
- ✅ Widely used
- ✅ Makes code cleaner
- ✅ One more dependency (acceptable trade-off)

---

## Python vs Scilab/MATLAB for Calculations

**Short answer: Use Python for most cases.**

### Python is Perfectly Capable

Python with NumPy/SciPy can do **everything** Scilab/MATLAB does:

- ✅ **Basic Math**: `4 * 4`, `sqrt(16)`, `sin(pi/2)`
- ✅ **Matrix Operations**: NumPy arrays
- ✅ **Linear Algebra**: `numpy.linalg`
- ✅ **ODEs**: `scipy.integrate.odeint`
- ✅ **Optimization**: `scipy.optimize`
- ✅ **Statistics**: `scipy.stats`
- ✅ **Signal Processing**: `scipy.signal`
- ✅ **Engineering Functions**: All available in SciPy

### When Python is Better

1. **Familiarity**: Most developers know Python
2. **Ecosystem**: Huge library ecosystem (pandas, matplotlib, etc.)
3. **Integration**: Easy to integrate with other Python code
4. **No External Dependency**: No need to install Scilab/MATLAB
5. **Performance**: NumPy is highly optimized (often faster than MATLAB)

### When Scilab/MATLAB Might Be Useful

1. **Existing Code**: You have MATLAB scripts you want to reuse
2. **MATLAB Toolboxes**: Need specific MATLAB toolboxes (Simulink, etc.)
3. **Team Expertise**: Team already knows MATLAB
4. **Legacy Systems**: Integrating with existing MATLAB workflows

### Recommendation

**Use Python** unless you have a specific reason to use Scilab/MATLAB.

---

## Updated Calculation Server: Python-Based

Here's a **Python-based** calculation server using **FastMCP**:

### Directory Structure

```
mcp-servers/calculation-engine/
├── config.json
├── server.py
├── calculations/
│   ├── dates.py
│   ├── mos.py
│   └── structural.py
├── requirements.txt
└── README.md
```

### requirements.txt

```txt
mcp>=1.0.0
numpy>=1.24.0
scipy>=1.10.0
```

### server.py (FastMCP Version)

```python
#!/usr/bin/env python3
"""
Deterministic Calculation MCP Server
Uses Python (NumPy/SciPy) for guaranteed accurate calculations
"""
from mcp import FastMCP
from calculations.dates import calculate_days_between, calculate_workdays
from calculations.mos import evaluate_mos, evaluate_mos_batch
from calculations.structural import structural_analysis, stress_analysis
from calculations.math import solve_expression, solve_matrix, solve_ode

mcp = FastMCP("calculation-engine")

# Date calculations
@mcp.tool()
def calculate_days_between(date1: str, date2: str) -> dict:
    """
    Calculate days between two dates (deterministic, always accurate).

    Args:
        date1: First date in ISO format (YYYY-MM-DD)
        date2: Second date in ISO format (YYYY-MM-DD)

    Returns:
        Dictionary with days, direction, and exact flag
    """
    return calculate_days_between({"date1": date1, "date2": date2})

@mcp.tool()
def calculate_workdays(date1: str, date2: str) -> dict:
    """Calculate workdays between two dates (excludes weekends)"""
    return calculate_workdays({"date1": date1, "date2": date2})

# MOS evaluations
@mcp.tool()
def evaluate_mos(
    mos_value: float,
    min_threshold: float = 0.15,
    preferred_threshold: float = 0.25
) -> dict:
    """
    Evaluate Margin of Safety against thresholds (deterministic).

    Args:
        mos_value: MOS value to evaluate
        min_threshold: Minimum acceptable MOS (default: 0.15)
        preferred_threshold: Preferred MOS (default: 0.25)

    Returns:
        Dictionary with status, color, and flags
    """
    return evaluate_mos({
        "mos_value": mos_value,
        "min_threshold": min_threshold,
        "preferred_threshold": preferred_threshold
    })

# Math operations
@mcp.tool()
def solve_expression(expression: str) -> dict:
    """
    Solve mathematical expression using Python/NumPy (deterministic, always accurate).

    Examples:
        - "4 * 4" → 16
        - "sqrt(16)" → 4.0
        - "sin(pi/2)" → 1.0
        - "log10(100)" → 2.0

    Args:
        expression: Mathematical expression in Python syntax

    Returns:
        Dictionary with result and exact flag
    """
    return solve_expression({"expression": expression})

@mcp.tool()
def solve_matrix(operation: str, matrix_a: list, matrix_b: list = None) -> dict:
    """
    Perform matrix operations using NumPy.

    Operations: multiply, add, subtract, inverse, transpose, determinant

    Args:
        operation: Operation to perform
        matrix_a: First matrix (2D list)
        matrix_b: Second matrix (if needed)

    Returns:
        Dictionary with result matrix
    """
    return solve_matrix({
        "operation": operation,
        "matrix_a": matrix_a,
        "matrix_b": matrix_b
    })

# Structural analysis
@mcp.tool()
def structural_analysis(
    load: float,
    area: float,
    material: str = "7075-T6"
) -> dict:
    """
    Perform structural stress analysis (deterministic).

    Args:
        load: Applied load (lbs)
        area: Cross-sectional area (in²)
        material: Material type (default: 7075-T6)

    Returns:
        Dictionary with stress, MOS, and status
    """
    return structural_analysis({
        "load": load,
        "area": area,
        "material": material
    })

if __name__ == "__main__":
    mcp.run()
```

### calculations/math.py (Python-Based)

```python
"""Mathematical operations using NumPy/SciPy"""
import numpy as np
from scipy import optimize, integrate, stats
from typing import Dict, Any
import ast
import operator

# Safe operators for eval
SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
}

def safe_eval(expr: str) -> float:
    """Safely evaluate mathematical expression"""
    # Replace common math functions with numpy equivalents
    expr = expr.replace("sqrt", "np.sqrt")
    expr = expr.replace("sin", "np.sin")
    expr = expr.replace("cos", "np.cos")
    expr = expr.replace("tan", "np.tan")
    expr = expr.replace("log", "np.log")
    expr = expr.replace("log10", "np.log10")
    expr = expr.replace("exp", "np.exp")
    expr = expr.replace("pi", "np.pi")
    expr = expr.replace("e", "np.e")

    # Use numpy's safe eval
    return float(np.eval(expr))

def solve_expression(args: Dict[str, Any]) -> Dict[str, Any]:
    """Solve mathematical expression using Python/NumPy"""
    expression = args.get("expression")

    if not expression:
        return {"success": False, "error": "expression is required"}

    try:
        result = safe_eval(expression)
        return {
            "success": True,
            "result": float(result),
            "exact": True  # Deterministic
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def solve_matrix(args: Dict[str, Any]) -> Dict[str, Any]:
    """Perform matrix operations using NumPy"""
    operation = args.get("operation")
    matrix_a = np.array(args.get("matrix_a"))
    matrix_b = args.get("matrix_b")

    try:
        if operation == "multiply":
            if matrix_b is None:
                return {"success": False, "error": "matrix_b required for multiply"}
            result = np.dot(matrix_a, np.array(matrix_b))
        elif operation == "add":
            if matrix_b is None:
                return {"success": False, "error": "matrix_b required for add"}
            result = matrix_a + np.array(matrix_b)
        elif operation == "subtract":
            if matrix_b is None:
                return {"success": False, "error": "matrix_b required for subtract"}
            result = matrix_a - np.array(matrix_b)
        elif operation == "inverse":
            result = np.linalg.inv(matrix_a)
        elif operation == "transpose":
            result = matrix_a.T
        elif operation == "determinant":
            result = np.linalg.det(matrix_a)
            return {"success": True, "result": float(result), "exact": True}
        else:
            return {"success": False, "error": f"Unknown operation: {operation}"}

        return {
            "success": True,
            "result": result.tolist(),
            "exact": True
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def solve_ode(args: Dict[str, Any]) -> Dict[str, Any]:
    """Solve ordinary differential equation using SciPy"""
    # Example: dy/dt = -k*y
    equation = args.get("equation")
    initial = args.get("initial", 0)
    time_span = args.get("time_span", [0, 10])

    try:
        # Parse equation (simplified - would need more sophisticated parser)
        # For now, assume simple form: dy/dt = -k*y
        k = args.get("k", 0.1)

        def dydt(y, t):
            return -k * y

        t = np.linspace(time_span[0], time_span[1], 100)
        solution = integrate.odeint(dydt, initial, t)

        return {
            "success": True,
            "solution": solution.flatten().tolist(),
            "times": t.tolist(),
            "exact": True
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
```

### calculations/dates.py (Unchanged - Pure Python)

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
            "exact": True
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

---

## Comparison: FastMCP vs Raw

### Code Size

**Raw Implementation**: ~100 lines of boilerplate
**FastMCP**: ~20 lines of actual code

### Maintainability

**Raw Implementation**:

- Manual JSON parsing
- Manual error handling
- Manual tool registration

**FastMCP**:

- Automatic protocol handling
- Built-in error handling
- Decorator-based tools

### Performance

**Both are equivalent** - FastMCP just wraps the protocol handling.

---

## Migration Guide

### From Raw to FastMCP

**Before (Raw):**

```python
def main():
    tools = [{
        "name": "greet",
        "description": "Greet someone",
        "inputSchema": {...}
    }]

    init_response = {...}
    print(json.dumps(init_response), flush=True)

    for line in sys.stdin:
        request = json.loads(line)
        # ... handle request ...
```

**After (FastMCP):**

```python
from mcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
def greet(name: str) -> str:
    """Greet someone"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run()
```

**Much simpler!**

---

## Summary

### FastMCP: ✅ Use It

- **Pros**: Less code, cleaner, type-safe, well-maintained
- **Cons**: One more dependency (acceptable)
- **Verdict**: Use for new servers

### Python vs Scilab: ✅ Use Python

- **Pros**: Familiar, no external dependency, powerful (NumPy/SciPy)
- **Cons**: None for most use cases
- **Verdict**: Use Python unless you have existing MATLAB code

### Updated Recommendation

1. **Use FastMCP** for building MCP servers
2. **Use Python/NumPy/SciPy** for calculations
3. **Only use Scilab/MATLAB** if you have existing code or specific toolboxes

---

## Example: Complete FastMCP Server

```python
#!/usr/bin/env python3
from mcp import FastMCP
import numpy as np

mcp = FastMCP("calculation-engine")

@mcp.tool()
def calculate(expression: str) -> dict:
    """
    Calculate mathematical expression (deterministic).

    Examples: "4*4", "sqrt(16)", "sin(pi/2)"
    """
    try:
        result = float(np.eval(expression))
        return {"success": True, "result": result, "exact": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@mcp.tool()
def evaluate_mos(mos_value: float, min_threshold: float = 0.15) -> dict:
    """Evaluate Margin of Safety"""
    status = "PASS" if mos_value >= min_threshold else "FAIL"
    return {
        "success": True,
        "mos": mos_value,
        "status": status,
        "exact": True
    }

if __name__ == "__main__":
    mcp.run()
```

**That's it!** FastMCP handles everything else.













