# Dashboard Builder

## Overview

The Dashboard Builder allows users to create dashboards by asking natural language questions. The system uses LLM to understand questions and automatically creates queries that extract and visualize data from workbooks.

## Features

### 1. Natural Language Queries

Ask questions in plain English:

- "How many NDAs do we have in the NDA folder?"
- "How many NDAs are expiring within 90 days?"
- "List all PDFs in the Contracts workbook"
- "Show me documents added this month"

### 2. Automatic Query Parsing

- LLM analyzes your question
- Extracts query type (count, filter, date_range)
- Identifies target workbook
- Determines filters and parameters

### 3. Multiple Query Types

**Count Queries**: Count documents matching criteria

- "How many documents..."
- "Count all PDFs..."

**Date Range Queries**: Find documents by date ranges

- "Expiring within X days"
- "Added in the last month"

**Filter Queries**: List documents matching filters

- "List all PDFs..."
- "Show documents containing..."

### 4. Visual Results

- **Card View**: For count queries (shows number prominently)
- **Table View**: For lists and detailed data
- **Auto-refresh**: Queries can be refreshed manually

### 5. Dashboard Management

- Create multiple dashboards
- Add multiple queries to each dashboard
- Save and load dashboards
- Remove queries

## Usage

### Creating a Dashboard

1. Click "Dashboard" tab in main view
2. Click "+ New Dashboard"
3. Enter dashboard name
4. Start adding queries

### Adding Queries

1. Type your question in the input box
2. Examples:
   - "How many NDAs do we have?"
   - "How many NDAs are expiring within 90 days?"
   - "List all PDFs in Contracts"
3. Click "Add Query" or press Enter
4. Query is automatically parsed and executed
5. Results appear immediately

### Example Questions

**Counting Documents:**

- "How many NDAs do we have?"
- "Count all PDFs in the NDA workbook"
- "How many documents are in Contracts?"

**Expiration Queries:**

- "How many NDAs are expiring within 90 days?"
- "Show NDAs expiring in the next 30 days"
- "What contracts expire this month?"

**Filtering:**

- "List all PDFs in NDA workbook"
- "Show me all markdown files"
- "What documents contain 'contract'?"

## How It Works

### 1. Question Parsing

```
User Question
    ↓
LLM analyzes question
    ↓
Extracts: queryType, workbookName, filters, metric
    ↓
Creates DashboardQuery object
```

### 2. Query Execution

```
DashboardQuery
    ↓
Execute based on queryType
    ↓
Read workbook data
    ↓
Apply filters
    ↓
Return DashboardResult
```

### 3. Result Display

- Count queries → Card view with number
- Filter/Date queries → Table view with data
- Results cached until refresh

## Query Types

### Count Query

**Purpose**: Count documents matching criteria

**Example**: "How many NDAs do we have?"

**Result**:

- Card showing count
- Metadata (workbook name, total documents)

### Date Range Query

**Purpose**: Find documents by expiration or date ranges

**Example**: "How many NDAs are expiring within 90 days?"

**Result**:

- Table showing expiring documents
- Columns: filename, expiration date, days until expiry
- Sorted by expiration date

**Date Extraction**:

- Tries to extract dates from filenames (e.g., "NDA_2024-12-31.pdf")
- Falls back to addedAt + 1 year if no date found
- Future: Will parse document content for expiration dates

### Filter Query

**Purpose**: List documents matching filters

**Example**: "List all PDFs in Contracts"

**Result**:

- Table showing matching documents
- Columns: filename, added date, path

## Implementation Details

### Question Parsing

Uses LLM to parse questions:

1. System prompt explains available workbooks
2. LLM extracts query parameters
3. Returns structured JSON
4. Falls back to simple regex parsing if LLM fails

### Date Extraction

Currently uses heuristics:

- Looks for dates in filenames (YYYY-MM-DD format)
- Defaults to addedAt + 1 year
- Future: Parse document content for expiration dates

### Storage

- Dashboards stored in localStorage
- Queries saved with results
- Persists across app restarts

## Future Enhancements

1. **Better Date Extraction**: Parse document content for expiration dates
2. **More Chart Types**: Bar charts, pie charts, line graphs
3. **Custom Filters**: More sophisticated filtering options
4. **Scheduled Refresh**: Auto-refresh queries periodically
5. **Export**: Export dashboard data to CSV/Excel
6. **Sharing**: Share dashboards with others
7. **Aggregations**: Sum, average, group by operations
8. **Document Content Search**: Search within document contents, not just filenames

## Limitations

- Date extraction is heuristic-based (not parsing document content yet)
- Limited to filename and metadata filtering
- No document content search yet
- Results cached (manual refresh required)
