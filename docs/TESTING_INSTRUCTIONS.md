# Dashboard Testing Instructions

## What Was Implemented

### JSON Schema-Based Prompt Management

The Dashboard MCP Server now uses **strict JSON schemas** for each tile type. This ensures the LLM always returns properly formatted data.

### Tile Types Available

1. **Counter** - Single numeric value
   - Schema: `{"value": number, "label": string, "unit": string}`
   - Example: "What is the main gear brake assembly MOS?" → 0.24

2. **Counter Warning** - Number with alert level
   - Schema: `{"value": number, "label": string, "severity": "low|medium|high", "items": []}`
   - Example: "How many tests are due within 90 days?" → 2 (with warning level)

3. **Graph** - Chart data
   - Schema: `{"labels": [], "values": [], "title": string}`
   - Example: "Show document types breakdown" → Bar/Pie chart

4. **Table** - Tabular data
   - Schema: `{"rows": [{"col1": "val", "col2": "val"}]}`
   - Example: "List all tests due soon" → Table with columns

5. **Text** - Summary with key facts
   - Schema: `{"summary": string, "keyFacts": []}`
   - Example: "Summarize budget status" → Formatted text with bullets

6. **Date** - Date display with countdown
   - Schema: `{"date": "YYYY-MM-DD", "label": string, "daysUntil": number}`
   - Example: "When does Acme Aerospace NDA expire?" → Date + countdown

7. **Color** - Status indicator (green/yellow/red)
   - Schema: `{"color": "green|yellow|red", "label": string, "message": string}`
   - Example: "What is the budget health?" → Red/Yellow/Green indicator

## Test Data Created

Standard test dataset with:
- **AC-1000 Aircraft**: 5 markdown files with MOS values
- **Test Schedule**: 2 markdown files with test dates
- **Supplier Agreements**: 3 markdown files with NDA expirations
- **Budget & Costs**: 1 CSV + 1 markdown with budget data

**Total**: 12 documents

## Automated Tests Status

✅ **All automated tests passing (5/5)**
- Counter tile formatting ✓
- Counter warning formatting ✓
- Graph formatting ✓
- Table formatting ✓
- Text formatting ✓

## UI Testing Required

**YOU MUST TEST THESE IN THE ELECTRON APP:**

### Test 1: Counter Tile
**Question**: "What is the main gear brake assembly MOS?"
**Expected**:
- Tile type: Counter
- Value: 0.24
- Label: "Main Gear Brake MOS"

**How to test**:
1. Create a new dashboard
2. Add query with the question above
3. Verify it shows 0.24 as a number (not text)

### Test 2: Counter Warning Tile
**Question**: "How many tests are due within 90 days?"
**Expected**:
- Tile type: Counter Warning
- Value: 2
- Level: Warning (yellow/⚡)
- Items shown: "Main Gear Static (45 days)", "Nose Gear Static (85 days)"

**How to test**:
1. Add this query to dashboard
2. Verify it shows 2 with a warning indicator
3. Verify it lists the 2 tests

### Test 3: Graph Tile
**Question**: "Show document types breakdown"
**Expected**:
- Tile type: Graph
- Chart showing: Markdown (11), CSV (1)

**How to test**:
1. Add this query
2. Verify it shows a bar chart (not text)

### Test 4: Table Tile
**Question**: "List all tests due soon"
**Expected**:
- Tile type: Table
- Rows: Main Gear (45 days), Nose Gear (85 days)
- Columns: Test, Days, Status

**How to test**:
1. Add this query
2. Verify it shows a table (not text)
3. Verify 2 rows displayed

### Test 5: Text Tile
**Question**: "Summarize budget status"
**Expected**:
- Tile type: Text
- Summary with key facts as bullets

**How to test**:
1. Add this query
2. Verify it shows formatted text with bullets

## Known Issues to Watch For

1. **LLM not following JSON schema**
   - Symptom: Returns text instead of JSON
   - Fix: Prompts may need strengthening

2. **RAG not finding content**
   - Symptom: Returns "N/A" or incorrect values
   - Fix: May need to adjust RAG search

3. **Tile type not saved**
   - Symptom: Same question returns different format each time
   - Fix: Ensure tileType is saved with query

## Restart Required

After code changes, you MUST:
1. **Close Electron app completely**
2. **Run**: `npm run dev`
3. **Wait for app to start**
4. **Test in UI**

## Test Checklist

- [ ] Counter tile shows correct number (not text)
- [ ] Counter warning shows warning level + items
- [ ] Graph shows chart (not text)
- [ ] Table shows table (not text)
- [ ] Text tile shows formatted summary
- [ ] Tile refresh works
- [ ] Multiple tiles on one dashboard work
- [ ] Tiles persist after app restart

## If Tests Fail

1. Check browser console for errors
2. Check terminal for MCP server errors
3. Verify standard test data is loaded (12 documents)
4. Try deleting dashboard and creating fresh one

---

**DO NOT CLAIM SUCCESS UNTIL ALL UI TESTS PASS!**
