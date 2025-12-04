#!/usr/bin/env python3
"""
Workbook Dashboard Server - Generates and executes visualization code
Creates dynamic visualizations (counters, graphs, tables, text) from natural language questions
"""
import os
import sys
import json
import base64
import tempfile
import subprocess
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

# Get data directory from environment
DATA_DIR = os.environ.get("INSIGHTLM_DATA_DIR", "")

# Import file reading utilities from RAG server
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'workbook-rag'))
try:
    from server import read_file, get_data_dir as rag_get_data_dir
except ImportError:
    print("Warning: Could not import RAG server utilities", file=sys.stderr)
    read_file = None
    rag_get_data_dir = None

def get_data_dir() -> str:
    """Get application data directory"""
    if DATA_DIR:
        return DATA_DIR

    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            return str(Path(appdata) / "insightLM-LT")
    else:
        home = os.environ.get("HOME", "")
        if home:
            return str(Path(home) / ".config" / "insightLM-LT")

    raise ValueError("Could not determine data directory")


def load_workbooks() -> List[Dict[str, Any]]:
    """Load all workbooks from storage"""
    try:
        data_dir = Path(get_data_dir())
        workbooks_dir = data_dir / "workbooks"

        if not workbooks_dir.exists():
            return []

        workbooks = []
        # Each workbook is stored in its own UUID folder
        for workbook_folder in workbooks_dir.iterdir():
            if workbook_folder.is_dir():
                workbook_file = workbook_folder / "workbook.json"
                if workbook_file.exists():
                    with open(workbook_file, 'r', encoding='utf-8') as f:
                        workbook_data = json.load(f)
                        # Add 'archived' field if missing
                        if 'archived' not in workbook_data:
                            workbook_data['archived'] = False
                        workbooks.append(workbook_data)

        return workbooks
    except Exception as e:
        print(f"Error loading workbooks: {e}", file=sys.stderr)
        return []


def get_workbook_by_id(workbook_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific workbook by ID"""
    workbooks = load_workbooks()
    return next((wb for wb in workbooks if wb['id'] == workbook_id), None)


def analyze_question(question: str, workbooks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze a natural language question and determine:
    - Visualization type (counter, counter_warning, graph, table, text)
    - Target workbook
    - Required data
    - Suggested chart configuration
    """
    workbook_names = [wb['name'] for wb in workbooks if not wb.get('archived', False)]

    analysis_prompt = f"""You are a dashboard visualization analyzer. Analyze the user's question and determine the best visualization type.

Available workbooks: {', '.join(workbook_names) if workbook_names else 'none'}

Question: "{question}"

Determine:
1. **Visualization Type**: Choose ONE of:
   - "counter": Simple numeric value (e.g., "How many NDAs?")
   - "counter_warning": Number with threshold/warning (e.g., "How many expiring soon?")
   - "graph": Bar/Line/Pie chart (e.g., "Show breakdown by type")
   - "table": List of items with columns (e.g., "List all contracts")
   - "text": Summary or explanation (e.g., "Summarize all NDAs")

2. **Workbook**: Which workbook to query (exact name or null)

3. **Data Needed**: What data to extract (e.g., document count, file list, dates, content summary)

4. **Chart Config**: If graph, what type? (bar, line, pie, scatter)

Respond with ONLY valid JSON (no markdown, no explanation):
{{
  "vizType": "counter|counter_warning|graph|table|text",
  "workbookName": "exact name or null",
  "dataNeeded": "description of data to extract",
  "chartType": "bar|line|pie|scatter|null",
  "threshold": number or null (for counter_warning),
  "confidence": 0.0-1.0
}}

Examples:
- "How many NDAs do we have?" → {{"vizType":"counter","workbookName":"NDA","dataNeeded":"count of documents","chartType":null,"threshold":null,"confidence":0.9}}
- "Show me document types as a pie chart" → {{"vizType":"graph","workbookName":null,"dataNeeded":"document count by extension","chartType":"pie","threshold":null,"confidence":0.95}}
- "List all contracts expiring in 90 days" → {{"vizType":"table","workbookName":"Contracts","dataNeeded":"documents with dates and expiry","chartType":null,"threshold":null,"confidence":0.85}}
"""

    # For now, return a simple analysis (we'll integrate LLM later)
    # This is a fallback parser
    question_lower = question.lower()

    # Detect visualization type
    if any(word in question_lower for word in ['how many', 'count', 'number of']):
        if any(word in question_lower for word in ['expiring', 'expire', 'warning', 'soon']):
            viz_type = "counter_warning"
        else:
            viz_type = "counter"
    elif any(word in question_lower for word in ['chart', 'graph', 'plot', 'pie', 'bar', 'breakdown']):
        viz_type = "graph"
    elif any(word in question_lower for word in ['list', 'show all', 'table']):
        viz_type = "table"
    elif any(word in question_lower for word in ['summarize', 'summary', 'explain', 'describe']):
        viz_type = "text"
    else:
        viz_type = "counter"  # default

    # Detect chart type
    chart_type = None
    if viz_type == "graph":
        if 'pie' in question_lower:
            chart_type = "pie"
        elif 'line' in question_lower:
            chart_type = "line"
        elif 'scatter' in question_lower:
            chart_type = "scatter"
        else:
            chart_type = "bar"

    # Detect workbook
    workbook_name = None
    for wb in workbooks:
        if wb['name'].lower() in question_lower:
            workbook_name = wb['name']
            break

    # Detect file type filter
    file_type = None
    if 'pdf' in question_lower and 'pdfs' in question_lower:
        file_type = 'pdf'
    elif 'csv' in question_lower:
        file_type = 'csv'
    elif 'docx' in question_lower or 'word' in question_lower or 'doc ' in question_lower:
        file_type = 'docx'
    elif 'markdown' in question_lower or ' md ' in question_lower or 'md files' in question_lower:
        file_type = 'md'
    elif 'excel' in question_lower or 'xlsx' in question_lower or 'spreadsheet' in question_lower:
        file_type = 'xlsx'
    elif 'txt' in question_lower or 'text file' in question_lower:
        file_type = 'txt'

    return {
        "vizType": viz_type,
        "workbookName": workbook_name,
        "dataNeeded": question,
        "chartType": chart_type,
        "fileType": file_type,
        "threshold": 90 if viz_type == "counter_warning" else None,
        "confidence": 0.7
    }


def generate_visualization_code(
    question: str,
    viz_type: str,
    workbook_data: Dict[str, Any],
    chart_type: Optional[str] = None,
    file_type: Optional[str] = None
) -> str:
    """
    Generate Python code to create the visualization
    Uses Plotly for interactive charts
    """

    if viz_type == "counter":
        return generate_counter_code(question, workbook_data, file_type)
    elif viz_type == "counter_warning":
        return generate_counter_warning_code(question, workbook_data, file_type)
    elif viz_type == "graph":
        return generate_graph_code(question, workbook_data, chart_type or "bar", file_type)
    elif viz_type == "table":
        return generate_table_code(question, workbook_data, file_type)
    elif viz_type == "text":
        return generate_text_code(question, workbook_data, file_type)
    else:
        raise ValueError(f"Unknown visualization type: {viz_type}")


def generate_counter_code(question: str, workbook_data: Dict[str, Any], file_type: Optional[str] = None) -> str:
    """Generate code for a simple counter visualization"""
    workbook_json = json.dumps(workbook_data, indent=2)
    filter_code = ""
    if file_type:
        filter_code = f"\ndocuments = [doc for doc in documents if doc.get('filename', '').lower().endswith('.{file_type}')]"

    return f"""
import json

# Extract data
workbook = json.loads('''{workbook_json}''')
documents = [doc for doc in workbook.get('documents', []) if not doc.get('archived', False)]{filter_code}

# Calculate count
count = len(documents)

# Return result
result = {{
    "type": "counter",
    "value": count,
    "label": "{workbook_data.get('name', 'Documents')}",
    "subtitle": f"{{count}} documents total"
}}

print(json.dumps(result))
"""


def generate_counter_warning_code(question: str, workbook_data: Dict[str, Any], file_type: Optional[str] = None) -> str:
    """Generate code for a counter with warning threshold"""
    workbook_json = json.dumps(workbook_data, indent=2)
    filter_code = ""
    if file_type:
        filter_code = f"\ndocuments = [doc for doc in documents if doc.get('filename', '').lower().endswith('.{file_type}')]"

    return f"""
import json
from datetime import datetime, timedelta

# Extract data
workbook = json.loads('''{workbook_json}''')
documents = [doc for doc in workbook.get('documents', []) if not doc.get('archived', False)]{filter_code}

# Try to detect expiring documents (look for dates in filename or assume 1 year from addedAt)
expiring_docs = []
threshold_days = 90

for doc in documents:
    # Simple heuristic: check if filename contains a date
    import re
    date_match = re.search(r'(\\d{{4}})[-/](\\d{{2}})[-/](\\d{{2}})', doc.get('filename', ''))

    if date_match:
        try:
            exp_date = datetime.strptime(f"{{date_match.group(1)}}-{{date_match.group(2)}}-{{date_match.group(3)}}", "%Y-%m-%d")
            days_until = (exp_date - datetime.now()).days

            if 0 <= days_until <= threshold_days:
                expiring_docs.append({{'filename': doc['filename'], 'days': days_until}})
        except:
            pass

count = len(expiring_docs)

# Determine warning level
if count == 0:
    level = "success"
elif count < 5:
    level = "warning"
else:
    level = "danger"

# Return result
result = {{
    "type": "counter_warning",
    "value": count,
    "level": level,
    "label": "Expiring Soon",
    "subtitle": f"Within {{threshold_days}} days",
    "threshold": threshold_days
}}

print(json.dumps(result))
"""


def generate_graph_code(question: str, workbook_data: Dict[str, Any], chart_type: str, file_type: Optional[str] = None) -> str:
    """Generate code for a graph visualization using Plotly"""
    workbook_json = json.dumps(workbook_data, indent=2)
    filter_code = ""
    if file_type:
        filter_code = f"\ndocuments = [doc for doc in documents if doc.get('filename', '').lower().endswith('.{file_type}')]"

    return f"""
import json
import plotly.graph_objects as go
import plotly.io as pio
from collections import Counter
from pathlib import Path

# Extract data
workbook = json.loads('''{workbook_json}''')
documents = [doc for doc in workbook.get('documents', []) if not doc.get('archived', False)]{filter_code}

# Analyze document types
extensions = [Path(doc.get('filename', '')).suffix.lower().replace('.', '') or 'no_ext'
              for doc in documents]
ext_counts = Counter(extensions)

# Prepare data
labels = list(ext_counts.keys())
values = list(ext_counts.values())

# Create chart
if "{chart_type}" == "pie":
    fig = go.Figure(data=[go.Pie(labels=labels, values=values)])
    fig.update_layout(title="Document Types Distribution")
elif "{chart_type}" == "bar":
    fig = go.Figure(data=[go.Bar(x=labels, y=values)])
    fig.update_layout(
        title="Document Types",
        xaxis_title="File Type",
        yaxis_title="Count"
    )
elif "{chart_type}" == "line":
    fig = go.Figure(data=[go.Scatter(x=labels, y=values, mode='lines+markers')])
    fig.update_layout(
        title="Document Types Trend",
        xaxis_title="File Type",
        yaxis_title="Count"
    )
else:
    fig = go.Figure(data=[go.Bar(x=labels, y=values)])

# Export to HTML
html = pio.to_html(fig, include_plotlyjs='cdn', config={{'displayModeBar': False}})

# Return result
result = {{
    "type": "graph",
    "chartType": "{chart_type}",
    "html": html,
    "data": {{"labels": labels, "values": values}}
}}

print(json.dumps(result))
"""


def generate_table_code(question: str, workbook_data: Dict[str, Any], file_type: Optional[str] = None) -> str:
    """Generate code for a table visualization"""
    workbook_json = json.dumps(workbook_data, indent=2)
    filter_code = ""
    if file_type:
        filter_code = f"\ndocuments = [doc for doc in documents if doc.get('filename', '').lower().endswith('.{file_type}')]"

    return f"""
import json
from datetime import datetime
from pathlib import Path

# Extract data
workbook = json.loads('''{workbook_json}''')
documents = [doc for doc in workbook.get('documents', []) if not doc.get('archived', False)]{filter_code}

# Prepare table data
rows = []
for doc in documents:
    rows.append({{
        "Filename": doc.get('filename', 'Unknown'),
        "Type": Path(doc.get('filename', '')).suffix.upper().replace('.', ''),
        "Added": datetime.fromisoformat(doc.get('addedAt', '')).strftime('%Y-%m-%d') if doc.get('addedAt') else 'Unknown',
        "Size": f"{{doc.get('size', 0) // 1024}} KB" if doc.get('size') else 'Unknown'
    }})

# Return result
result = {{
    "type": "table",
    "columns": ["Filename", "Type", "Added", "Size"],
    "rows": rows,
    "totalRows": len(rows)
}}

print(json.dumps(result))
"""


def generate_text_code(question: str, workbook_data: Dict[str, Any], file_type: Optional[str] = None) -> str:
    """Generate code for a text summary"""
    workbook_json = json.dumps(workbook_data, indent=2)
    filter_code = ""
    if file_type:
        filter_code = f"\ndocuments = [doc for doc in documents if doc.get('filename', '').lower().endswith('.{file_type}')]"

    return f"""
import json
from collections import Counter
from pathlib import Path

# Extract data
workbook = json.loads('''{workbook_json}''')
documents = [doc for doc in workbook.get('documents', []) if not doc.get('archived', False)]{filter_code}

# Generate summary
total_docs = len(documents)
extensions = [Path(doc.get('filename', '')).suffix.lower() for doc in documents]
ext_counts = Counter(extensions)

summary_parts = [
    f"**Workbook: {{workbook.get('name', 'Unknown')}}**",
    f"",
    f"Total Documents: **{{total_docs}}**",
    f"",
    f"**Breakdown by Type:**"
]

for ext, count in ext_counts.most_common():
    ext_display = ext.upper().replace('.', '') if ext else 'NO EXTENSION'
    summary_parts.append(f"- {{ext_display}}: {{count}} document{{'' if count == 1 else 's'}}")

summary = "\\n".join(summary_parts)

# Return result
result = {{
    "type": "text",
    "content": summary,
    "format": "markdown"
}}

print(json.dumps(result))
"""


def execute_visualization_code(code: str) -> Dict[str, Any]:
    """
    Execute the generated Python code in a safe subprocess
    Returns the visualization result
    """
    try:
        # Create a temporary file for the code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
            f.write(code)
            temp_file = f.name

        try:
            # Execute the code using Python subprocess
            result = subprocess.run(
                [sys.executable, temp_file],
                capture_output=True,
                text=True,
                timeout=30,  # 30 second timeout
                cwd=tempfile.gettempdir()
            )

            if result.returncode != 0:
                return {
                    "error": f"Code execution failed: {result.stderr}",
                    "type": "error"
                }

            # Parse the JSON output
            output = result.stdout.strip()
            return json.loads(output)

        finally:
            # Clean up temp file
            try:
                os.unlink(temp_file)
            except:
                pass

    except subprocess.TimeoutExpired:
        return {"error": "Code execution timed out", "type": "error"}
    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON output: {e}", "type": "error", "output": result.stdout}
    except Exception as e:
        return {"error": f"Execution error: {e}", "type": "error"}


# MCP Tools
def handle_analyze_dashboard_question(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool: analyze_dashboard_question
    Analyzes a natural language question and determines the best visualization type
    """
    question = args.get('question', '')
    workbook_id = args.get('workbookId')

    workbooks = load_workbooks()

    # Filter to specific workbook if provided
    if workbook_id:
        workbooks = [wb for wb in workbooks if wb['id'] == workbook_id]

    analysis = analyze_question(question, workbooks)

    return {
        "success": True,
        "analysis": analysis
    }


def handle_generate_dashboard_visualization(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool: generate_dashboard_visualization
    Generates and executes visualization code for a dashboard question
    """
    question = args.get('question', '')
    workbook_id = args.get('workbookId')
    viz_type = args.get('vizType', 'counter')
    chart_type = args.get('chartType')
    file_type = args.get('fileType')
    all_workbooks = args.get('allWorkbooks', [])

    # Determine workbook data
    if workbook_id:
        # Specific workbook requested
        workbook_data = get_workbook_by_id(workbook_id)
        if not workbook_data:
            return {
                "success": False,
                "error": f"Workbook not found: {workbook_id}"
            }
    else:
        # No specific workbook - aggregate across all workbooks
        if not all_workbooks:
            all_workbooks = load_workbooks()

        active_workbooks = [wb for wb in all_workbooks if not wb.get('archived', False)]
        if not active_workbooks:
            return {
                "success": False,
                "error": "No workbooks available"
            }

        # Create aggregate workbook for multi-workbook queries
        workbook_data = {
            "id": "all-workbooks",
            "name": "All Workbooks",
            "documents": [],
            "createdAt": "",
            "updatedAt": ""
        }

        # Aggregate all documents from all active workbooks
        for wb in active_workbooks:
            workbook_data["documents"].extend(wb.get('documents', []))

    # Generate visualization code
    try:
        code = generate_visualization_code(question, viz_type, workbook_data, chart_type, file_type)

        # Execute the code
        result = execute_visualization_code(code)

        if result.get('type') == 'error':
            return {
                "success": False,
                "error": result.get('error'),
                "code": code
            }

        return {
            "success": True,
            "result": result,
            "generatedCode": code,
            "workbookId": workbook_data['id'],
            "workbookName": workbook_data.get('name', 'Unknown')
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to generate visualization: {e}"
        }


def handle_execute_dashboard_query(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool: execute_dashboard_query
    Complete workflow: analyze question → generate code → execute → return result
    """
    question = args.get('question', '')
    workbook_id = args.get('workbookId')

    # Step 1: Analyze question
    all_workbooks = load_workbooks()
    if not all_workbooks:
        return {
            "success": False,
            "error": "No workbooks available"
        }

    analysis = analyze_question(question, all_workbooks)

    # Step 2: Determine target workbook(s)
    # If workbookId provided, use that specific workbook
    # If workbookName detected in question, use that workbook
    # Otherwise, aggregate across ALL workbooks
    target_workbook_id = workbook_id or analysis.get('workbookId')

    # Step 3: Generate and execute visualization
    viz_args = {
        'question': question,
        'workbookId': target_workbook_id,  # Can be None for all-workbooks queries
        'vizType': analysis['vizType'],
        'chartType': analysis.get('chartType'),
        'fileType': analysis.get('fileType'),  # File extension filter
        'allWorkbooks': all_workbooks  # Pass all workbooks for aggregation
    }

    return handle_generate_dashboard_visualization(viz_args)


# MCP Server Implementation
def handle_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Route tool calls to appropriate handlers"""
    handlers = {
        "analyze_dashboard_question": handle_analyze_dashboard_question,
        "generate_dashboard_visualization": handle_generate_dashboard_visualization,
        "execute_dashboard_query": handle_execute_dashboard_query,
    }

    handler = handlers.get(tool_name)
    if not handler:
        return {"error": f"Unknown tool: {tool_name}"}

    return handler(arguments)


def main():
    """Main MCP server loop"""
    print("Workbook Dashboard Server starting...", file=sys.stderr)

    # MCP tool definitions
    tools = [
        {
            "name": "analyze_dashboard_question",
            "description": "Analyzes a natural language question and determines the best visualization type (counter, graph, table, text)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The natural language question to analyze"
                    },
                    "workbookId": {
                        "type": "string",
                        "description": "Optional workbook ID to limit analysis to"
                    }
                },
                "required": ["question"]
            }
        },
        {
            "name": "generate_dashboard_visualization",
            "description": "Generates and executes Python code to create a visualization (counter, graph, table, or text summary)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The question being answered"
                    },
                    "workbookId": {
                        "type": "string",
                        "description": "The workbook ID to visualize"
                    },
                    "vizType": {
                        "type": "string",
                        "enum": ["counter", "counter_warning", "graph", "table", "text"],
                        "description": "Type of visualization to generate"
                    },
                    "chartType": {
                        "type": "string",
                        "enum": ["bar", "line", "pie", "scatter"],
                        "description": "For graph vizType, the specific chart type"
                    }
                },
                "required": ["question", "vizType"]
            }
        },
        {
            "name": "execute_dashboard_query",
            "description": "Complete workflow: analyzes question, generates visualization code, executes it, and returns the result. This is the main entry point for dashboard queries.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The natural language question (e.g., 'How many NDAs do we have?', 'Show me a pie chart of document types')"
                    },
                    "workbookId": {
                        "type": "string",
                        "description": "Optional workbook ID to query. If not provided, uses the first available workbook"
                    }
                },
                "required": ["question"]
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
                "name": "workbook-dashboard",
                "version": "1.0.0"
            },
            "capabilities": {
                "tools": tools
            }
        }
    }

    # MCP protocol loop (simplified for now)
    # In production, this would handle full JSON-RPC protocol
    print(json.dumps(init_response), flush=True)

    # Keep server running
    for line in sys.stdin:
        try:
            request = json.loads(line)
            method = request.get('method')

            if method == 'tools/call':
                params = request.get('params', {})
                tool_name = params.get('name')
                arguments = params.get('arguments', {})

                result = handle_tool_call(tool_name, arguments)

                response = {
                    "jsonrpc": "2.0",
                    "id": request.get('id'),
                    "result": result
                }
                print(json.dumps(response), flush=True)

        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": request.get('id') if 'request' in locals() else None,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }
            print(json.dumps(error_response), flush=True)


if __name__ == "__main__":
    main()
