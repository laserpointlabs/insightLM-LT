# Dashboard MCP Server - Future Enhancements

## Deterministic Calculations in MCP Server

### Current Approach (LLM-Based)

**As of December 2025**, the MCP server relies on the LLM to perform calculations:
- Days until expiration (e.g., "How many days until X expires?")
- Date arithmetic (e.g., "Which NDAs expire within 90 days?")
- Percentage calculations (e.g., "What percent over budget?")
- Status evaluations (e.g., "Is MOS below threshold?")

**Pros:**
- ✅ Simple architecture
- ✅ LLM can handle complex natural language
- ✅ Flexible - adapts to various question formats

**Cons:**
- ❌ LLM may miscalculate dates/numbers
- ❌ Inconsistent results for same question
- ❌ Token usage for simple math
- ❌ Cannot guarantee accuracy

### Future Enhancement: MCP-Side Calculations

**Proposal**: The MCP server should provide **pre-calculated values** to the LLM for deterministic operations.

#### Example: Date Calculations

**Current Flow (LLM calculates):**
```
User: "How many NDAs expire within 90 days?"
  ↓
MCP: Creates prompt with current date (2025-12-04)
  ↓
LLM: Reads NDAs, finds expiration dates, calculates days, counts
  ↓
LLM: Returns {"value": 2, ...}  ← May be wrong!
```

**Future Flow (MCP calculates):**
```
User: "How many NDAs expire within 90 days?"
  ↓
MCP: Scans workbooks, extracts all "Expiration Date:" fields
MCP: Calculates days until each date (deterministic)
MCP: Adds calculated data to prompt:
     "Context: NDA expirations:
      - Acme: 2025-08-15 (253 days)
      - Global: 2025-06-30 (207 days)
      - Titanium: 2026-03-20 (471 days)"
  ↓
LLM: Just counts which are < 90 days (or MCP already did this)
  ↓
LLM: Returns {"value": 0, ...}  ← Guaranteed accurate!
```

#### Example: MOS Status

**Current Flow:**
```
LLM: Reads "MOS: 0.24", compares to 0.25 threshold
LLM: Returns {"color": "yellow", ...}
```

**Future Flow:**
```
MCP: Extracts all "MOS: X.XX" values
MCP: Pre-calculates status for each:
     - Brake Assembly: 0.24 → MARGINAL (< 0.25)
     - Trunnion: 0.33 → PASS (>= 0.25)
MCP: Provides to LLM: "Pre-calculated statuses: ..."
LLM: Just formats the response
```

#### Example: Budget Variance

**Current Flow:**
```
LLM: Reads CSV, calculates (1350000-1200000)/1200000 = 12.5%
LLM: May miscalculate or round incorrectly
```

**Future Flow:**
```
MCP: Parses CSV using pandas
MCP: Calculates variance: -$150,000 (12.5%) ← Deterministic
MCP: Provides to LLM: "Manufacturing variance: -$150,000 (12.5%)"
LLM: Just formats for display
```

### Implementation Strategy

#### Phase 1: Document Structure Analyzers (Future)
```python
def analyze_workbook_dates(workbook_id: str) -> Dict[str, Any]:
    """
    Extract all dates from workbook documents
    Returns: {
      "expirations": [{"item": "Acme NDA", "date": "2025-08-15", "days": 253}],
      "tests": [{"name": "Main Gear", "date": "2025-02-18", "days": 45}],
      "milestones": [...]
    }
    """
```

#### Phase 2: Calculation Engines (Future)
```python
def calculate_mos_statuses(workbook_id: str) -> List[Dict]:
    """
    Extract all MOS values and evaluate against thresholds
    Returns: [
      {"component": "Brake", "mos": 0.24, "status": "MARGINAL", "color": "yellow"},
      {"component": "Trunnion", "mos": 0.33, "status": "PASS", "color": "green"}
    ]
    """
```

#### Phase 3: Pre-Processing Pipeline (Future)
```python
def enrich_prompt_with_calculations(question: str, tile_type: str) -> str:
    """
    Analyze question, determine what calculations are needed
    Perform calculations deterministically
    Inject calculated values into prompt
    """
```

### Why Not Now?

**Current priority**: Get basic functionality working with LLM doing everything.

**Later priorities** (when accuracy becomes critical):
1. Add deterministic date/time calculations
2. Add CSV/Excel parsing with pandas
3. Add regex-based data extraction
4. Add caching layer for repeated calculations

### Design Principles

1. **MCP server CAN do calculations** - It's not just a prompt template manager
2. **Keep it optional** - Some questions benefit from LLM flexibility
3. **Document what's deterministic** - Make it clear what's guaranteed accurate
4. **Provide both to LLM** - Give raw data AND calculated values

### Example Future Architecture

```python
def handle_dashboard_query(args):
    question = args['question']
    tile_type = args['tileType']

    # Step 1: Perform deterministic calculations
    calculations = perform_calculations(question, tile_type)
    # Returns: {"dates_calculated": [...], "mos_evaluated": [...], ...}

    # Step 2: Enrich prompt with calculations
    enriched_prompt = create_llm_request(question, tile_type, calculations)
    # Prompt now includes: "Pre-calculated values: ..."

    # Step 3: LLM just formats/selects from pre-calculated data
    # LLM returns: {"value": 2, ...} ← Using MCP's calculation
```

### Benefits of Future Approach

✅ **Accuracy**: Math is guaranteed correct
✅ **Performance**: No token usage for simple calculations
✅ **Consistency**: Same question always returns same result
✅ **Auditability**: Calculations can be logged/verified
✅ **Complexity**: Can handle complex calculations LLM can't do

### Tradeoffs

⚠️ **More code**: MCP server becomes more complex
⚠️ **Less flexible**: May not handle all question variations
⚠️ **Maintenance**: Calculation logic needs updates

---

**DECISION**: Document this for future enhancement, but keep LLM-based for MVP.

**When to implement**: When users report accuracy issues with dates/math calculations.





























