# Deterministic Calculation MCP Server - Proposal

## Concept

Create a dedicated MCP server for **guaranteed accurate calculations** using computational engines like Scilab (open-source MATLAB alternative).

## Name Options
- **Deterministic Calculation MCP** (DC-MCP)
- **Numerical Analysis MCP**
- **Engineering Calculation MCP**
- **Scilab MCP**

**Preferred**: `calculation-engine` (simple, clear)

## Architecture

### Current System (3 MCP Servers)
1. **workbook-rag** - Reads documents, searches content
2. **workbook-dashboard** - Manages prompts, formats responses
3. **workbook-manager** - Manages workbooks (CRUD operations)

### Proposed: Add 4th MCP Server
4. **calculation-engine** - Deterministic calculations using Scilab

## Why Scilab?

### Capabilities
- ✅ **Matrix operations** - Linear algebra, matrix math
- ✅ **ODEs/PDEs** - Ordinary/Partial differential equations
- ✅ **Optimization** - Minimize/maximize functions
- ✅ **Statistics** - Mean, std dev, distributions
- ✅ **Signal processing** - FFT, filters
- ✅ **Control systems** - Transfer functions, stability analysis
- ✅ **Numerical methods** - Integration, differentiation, root finding
- ✅ **Engineering functions** - Structural analysis, fluid dynamics helpers

### Benefits Over Python
- ✅ **MATLAB-compatible** - Engineers already know the syntax
- ✅ **Free and open-source** - No licensing issues
- ✅ **Engineering-focused** - Built for scientific computing
- ✅ **Interactive** - Can test calculations easily
- ✅ **Plotting** - Built-in visualization (if needed)

### Alternative: Octave
GNU Octave is another MATLAB-compatible alternative (could use either)

## MCP Server Design

### Tools Provided

```python
{
  "name": "calculate_days_between",
  "description": "Calculate days between two dates (deterministic)",
  "input": {"date1": "2025-12-04", "date2": "2025-08-15"},
  "output": {"days": 253, "direction": "future"}
}

{
  "name": "evaluate_mos",
  "description": "Evaluate Margin of Safety against thresholds",
  "input": {"mos_value": 0.24, "min_threshold": 0.15, "preferred_threshold": 0.25},
  "output": {
    "status": "MARGINAL",
    "color": "yellow",
    "meets_minimum": true,
    "meets_preferred": false
  }
}

{
  "name": "calculate_budget_variance",
  "description": "Calculate budget variance and percentages",
  "input": {"budgeted": 1200000, "actual": 1350000},
  "output": {
    "variance": -150000,
    "percent_over": 12.5,
    "status": "OVER_BUDGET"
  }
}

{
  "name": "solve_ode",
  "description": "Solve ordinary differential equations using Scilab",
  "input": {"equation": "dy/dt = -k*y", "initial": 100, "time_span": [0, 10]},
  "output": {"solution": [...], "times": [...]}
}

{
  "name": "structural_analysis",
  "description": "Perform structural calculations (stress, strain, deflection)",
  "input": {"load": 45000, "area": 2.5, "material": "7075-T6"},
  "output": {
    "stress": 18000,
    "allowable": 60000,
    "mos": 0.33,
    "status": "PASS"
  }
}

{
  "name": "execute_scilab",
  "description": "Execute arbitrary Scilab code (for complex analyses)",
  "input": {"code": "x = linspace(0, 10, 100); y = sin(x); mean(y)"},
  "output": {"result": 0.0015, "plots": null}
}
```

## Integration Patterns

### Pattern 1: Direct LLM Tool

LLM can call calculation server directly as a tool:

```
User: "How many NDAs expire within 90 days?"
  ↓
LLM (thinking): "I need to calculate date differences"
  ↓
LLM → Calculation MCP: calculate_days_between for each NDA
  ↓
Calculation MCP: Returns exact days (253, 207, 471)
  ↓
LLM: Counts which are < 90 → Returns 0
```

### Pattern 2: Dashboard Pre-Processing

Dashboard MCP calls calculation server before calling LLM:

```
User: "How many tests are due within 90 days?"
  ↓
Dashboard MCP → Calculation MCP: "Calculate test date countdowns"
  ↓
Calculation MCP: Returns [45 days, 85 days, 125 days, 180 days]
  ↓
Dashboard MCP → LLM: "Given these days [45, 85, 125, 180], how many < 90?"
  ↓
LLM: Simple counting → Returns {"value": 2, ...}
```

### Pattern 3: Hybrid Approach

Some calculations by MCP, some by LLM:

```
User: "Which components are most critical?"
  ↓
Dashboard MCP → Calculation MCP: "Evaluate all MOS values"
  ↓
Calculation MCP: Returns statuses for all components
  ↓
Dashboard MCP → LLM: "Given these evaluations, rank by criticality"
  ↓
LLM: Uses judgment + calculated data → Smart answer
```

## Implementation Details

### Server Structure
```
mcp-servers/
  calculation-engine/
    server.py           # MCP server implementation
    scilab_wrapper.py   # Python ↔ Scilab bridge
    calculations/       # Pre-built calculation modules
      dates.sci         # Date arithmetic functions
      mos.sci          # MOS evaluation functions
      budget.sci       # Budget variance functions
      structural.sci   # Structural analysis functions
    config.json
    requirements.txt    # Python deps
    README.md
```

### Dependencies
- **Python**: `subprocess`, `json` (for MCP protocol)
- **Scilab**: Installed separately (or Octave as alternative)
- **Optional**: `scilab2py` Python package for easier integration

### Communication Flow
```python
# Python calls Scilab
import subprocess

def call_scilab(code: str) -> str:
    result = subprocess.run(
        ['scilab', '-nw', '-f', temp_script],
        capture_output=True,
        text=True
    )
    return result.stdout
```

## Use Cases

### Engineering Dashboards
- **Structural Analysis**: Stress, strain, deflection, MOS
- **Load Cases**: Combined loading, fatigue life
- **Weight & Balance**: CG calculations, moment arms
- **Performance**: Range, endurance, climb rate
- **Stability**: Control derivatives, transfer functions

### Financial Dashboards
- **Budget Tracking**: Variance, burn rate, forecasting
- **Trend Analysis**: Moving averages, regression
- **Risk Analysis**: Monte Carlo simulations
- **Cost Modeling**: What-if scenarios

### Schedule Dashboards
- **Critical Path**: PERT/CPM calculations
- **Resource Loading**: Utilization, conflicts
- **Date Arithmetic**: Work days, deadlines
- **Risk Analysis**: Schedule variance, float

### Scientific Dashboards
- **Data Analysis**: Statistics, curve fitting
- **Simulations**: ODEs, PDEs, numerical solutions
- **Optimization**: Find optimal parameters
- **Validation**: Compare measured vs calculated

## Benefits

### Accuracy
- ✅ **Deterministic** - Same input = same output, always
- ✅ **IEEE 754** - Standard floating point (no LLM rounding errors)
- ✅ **Validated** - Scilab/Octave are proven tools
- ✅ **Testable** - Can unit test calculations

### Performance
- ✅ **Fast** - Compiled code vs LLM inference
- ✅ **No tokens** - Doesn't use API quota
- ✅ **Parallel** - Can run multiple calculations simultaneously
- ✅ **Cacheable** - Results can be cached

### Capability
- ✅ **Complex math** - ODEs, matrix ops, optimization
- ✅ **Engineering libraries** - Pre-built functions
- ✅ **Scripting** - Can write custom calculations
- ✅ **Plotting** - Can generate charts (if needed)

## Tradeoffs

### Pros
- Guaranteed accuracy for calculations
- No LLM token usage for math
- Reusable across dashboards
- Engineers can write custom calculations

### Cons
- Additional dependency (Scilab install)
- More complex architecture (4th MCP server)
- Requires learning Scilab syntax
- Maintenance overhead

## Decision Framework

**Use Calculation MCP when:**
- Accuracy is critical (safety, compliance)
- Complex math (ODEs, matrix ops, optimization)
- Repeated calculations (cacheable)
- Engineering-specific computations

**Use LLM when:**
- Natural language understanding needed
- Fuzzy matching, interpretation
- One-off questions
- Accuracy within ±5% is acceptable

## Implementation Priority

**Phase 1 (Current)**: LLM does everything
- ✅ Simple architecture
- ✅ MVP functionality
- ⏳ Testing in progress

**Phase 2 (Future)**: Add basic calculations
- Date arithmetic (days between, expirations)
- Simple math (variance %, ratios)
- MOS evaluation (threshold checks)

**Phase 3 (Future)**: Add Scilab integration
- Full computational engine
- Engineering calculations
- Optimization, simulation
- Complex analyses

## Example Implementation Snippet

```python
# mcp-servers/calculation-engine/server.py

def calculate_days_between(date1_str: str, date2_str: str) -> Dict[str, Any]:
    """Deterministic date arithmetic"""
    from datetime import datetime

    date1 = datetime.fromisoformat(date1_str)
    date2 = datetime.fromisoformat(date2_str)
    delta = (date2 - date1).days

    return {
        "days": abs(delta),
        "direction": "future" if delta > 0 else "past",
        "exact": True  # Flag indicating this is deterministic
    }

def evaluate_mos(mos_value: float, thresholds: Dict) -> Dict[str, Any]:
    """Deterministic MOS evaluation"""
    min_mos = thresholds.get('minimum', 0.15)
    pref_mos = thresholds.get('preferred', 0.25)

    if mos_value < min_mos:
        status = "FAIL"
        color = "red"
    elif mos_value < pref_mos:
        status = "MARGINAL"
        color = "yellow"
    else:
        status = "PASS"
        color = "green"

    return {
        "mos": mos_value,
        "status": status,
        "color": color,
        "meets_minimum": mos_value >= min_mos,
        "meets_preferred": mos_value >= pref_mos,
        "exact": True
    }
```

---

**STATUS**: Documented for future enhancement. Not blocking MVP.








