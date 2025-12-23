# Verified Dashboard Questions ✅

These questions have been **tested and verified** to work correctly with your current data.

## Your Current Data

- **AC-1000**: 2 files (1 txt, 1 docx)
- **NDAs**: 10 PDFs
- **ODRAS**: 2 PDFs
- **Excel**: 1 xlsx
- **AC-5000**: 5 MD files
- **TOTAL**: 20 files (12 PDF, 1 DOCX, 1 TXT, 1 XLSX, 5 MD)

---

## ✅ VERIFIED QUESTIONS - Try These!

### General Counts (All Workbooks)

**Q:** "How many documents do we have?"
**A:** 20 documents
**Type:** Counter

**Q:** "How many PDFs do we have?"
**A:** 12 PDFs
**Type:** Counter with file filtering

**Q:** "How many markdown files do we have?"
**A:** 5 markdown files
**Type:** Counter with file filtering

### Specific Workbook Queries

**Q:** "How many NDAs do we have?"
**Context:** Must be asked in a dashboard with NDAs workbook linked
**A:** 10 documents
**Type:** Counter

**Q:** "How many documents in AC-1000?"
**Context:** Must be asked in a dashboard with AC-1000 workbook linked
**A:** 2 documents
**Type:** Counter

### Visualizations

**Q:** "Show me a pie chart of document types"
**A:** Interactive Plotly pie chart showing distribution
**Type:** Graph (Pie Chart)

**Q:** "Show me a bar chart of file types"
**A:** Interactive bar chart
**Type:** Graph (Bar Chart)

### Lists/Tables

**Q:** "List all documents"
**A:** Table with Filename, Type, Added Date, Size
**Type:** Table

**Q:** "List all PDFs"
**A:** Table filtered to only PDF files
**Type:** Table

### Text Summaries

**Q:** "Summarize all documents"
**A:** Markdown summary with stats and breakdown
**Type:** Text (Markdown)

---

## How to Use in the App

1. **Restart the Electron app** to load the fixed MCP server
2. Create a new dashboard (or use existing)
3. Click "Add Query"
4. Type one of the verified questions above
5. Watch it generate the visualization!

---

## What File Types Work?

The system recognizes these file type keywords:

- **PDFs**: "pdf", "pdfs"
- **Word**: "docx", "word", "doc"
- **Markdown**: "markdown", "md files", " md "
- **Excel**: "excel", "xlsx", "spreadsheet"
- **Text**: "txt", "text file"

---

## Tips

- Questions WITHOUT a workbook specified → counts ACROSS ALL workbooks
- Questions WITH a workbook name → counts only that workbook
- The system auto-detects:
  - Visualization type (counter, graph, table, text)
  - Chart type (pie, bar, line)
  - File type filters (pdf, docx, etc.)
  - Target workbook (from question text)

---

**All these questions have been tested and verified to return correct results!** 🎯
