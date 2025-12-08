#!/usr/bin/env python3
"""
Dashboard MCP Server - Prompt Manager for Structured Visualizations
This server manages prompts and formats LLM responses for different tile types.
It does NOT read files or couple with other MCP servers.
"""
import os
import sys
import json
import re
from typing import Dict, Any, Optional

# JSON schemas for each tile type
TILE_SCHEMAS = {
    "counter": {
        "system": """You are a data extraction assistant for dashboard counters.
The user will ask a question about their documents.

You MUST respond with ONLY valid JSON in this exact format:
{
  "value": <number>,
  "label": "<short label>",
  "unit": "<optional unit like 'documents', 'tests', etc>"
}

Rules:
1. Search the documents using available tools
2. Extract the specific numeric value requested
3. Return ONLY the JSON object (no markdown, no explanation)
4. If you cannot find a value, use "value": null

Examples:
Question: "What is the main gear brake assembly MOS?"
Response: {"value": 0.24, "label": "Main Gear Brake MOS", "unit": ""}

Question: "How many tests are due within 90 days?"
Response: {"value": 2, "label": "Tests Due Soon", "unit": "tests"}

Question: "What is the manufacturing budget variance?"
Response: {"value": -150000, "label": "Manufacturing Variance", "unit": "USD"}""",
        "schema": {
            "value": "number or null",
            "label": "string",
            "unit": "string (optional)"
        }
    },

    "counter_warning": {
        "system": """You are a data extraction assistant for dashboard warning counters.
The user will ask about items that may need attention (expiring, below threshold, etc).

You MUST respond with ONLY valid JSON in this exact format:
{
  "value": <number>,
  "label": "<short label>",
  "severity": "low|medium|high",
  "items": ["<item1>", "<item2>"]
}

Severity levels:
- "low": 0 items or minor concern
- "medium": 1-4 items need attention
- "high": 5+ items need attention

For expiration questions:
- Search documents for expiration dates
- Compare to CURRENT DATE (provided above)
- Calculate days until expiration
- Count items expiring within the requested timeframe

Examples:
Question: "How many NDAs are expiring within 90 days?"
Response: {"value": 2, "label": "NDAs Expiring Soon", "severity": "medium", "items": ["Acme Aerospace (expires 2025-08-15)", "Global Avionics (expires 2025-06-30)"]}

Question: "How many components have MOS below 0.25?"
Response: {"value": 2, "label": "Low MOS Components", "severity": "high", "items": ["Brake Assembly (0.24)", "Wing Spar Outboard (0.21)"]}

Question: "How many tests are due within 90 days?"
Response: {"value": 2, "label": "Tests Due Soon", "severity": "medium", "items": ["Main Gear Static (45 days)", "Nose Gear Static (85 days)"]}""",
        "schema": {
            "value": "number",
            "label": "string",
            "severity": "low|medium|high",
            "items": "array of strings"
        }
    },

    "graph": {
        "system": """You are a data extraction assistant for dashboard charts.
The user will ask for data to visualize.

You MUST respond with ONLY valid JSON in this exact format:
{
  "labels": ["label1", "label2", "label3"],
  "values": [number1, number2, number3],
  "title": "<chart title>"
}

Rules:
1. Search the documents using available tools
2. Extract the relevant data
3. Labels must be strings, values must be numbers
4. Arrays must be same length
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "Show document types breakdown"
Response: {"labels": ["PDF", "Markdown", "CSV"], "values": [0, 11, 1], "title": "Document Types"}

Question: "Show tests by days until due"
Response: {"labels": ["Main Gear", "Nose Gear", "Wing Spar"], "values": [45, 85, 125], "title": "Tests by Days Until Due"}

Question: "Show MOS values for main gear components"
Response: {"labels": ["Trunnion", "Shock Strut", "Axle", "Brake"], "values": [0.33, 0.32, 0.31, 0.24], "title": "Main Gear MOS Values"}""",
        "schema": {
            "labels": "array of strings",
            "values": "array of numbers",
            "title": "string"
        }
    },

    "table": {
        "system": """You are a data extraction assistant for dashboard tables.
The user will ask for a list of items.

You MUST respond with ONLY valid JSON in this exact format:
{
  "rows": [
    {"column1": "value1", "column2": "value2"},
    {"column1": "value3", "column2": "value4"}
  ]
}

Rules:
1. Search the documents using available tools
2. Extract all relevant items
3. Each row must have the same columns
4. Keep column names short and clear
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "List all tests due soon"
Response: {"rows": [{"Test": "Main Gear Static", "Days": 45, "Status": "Due Soon"}, {"Test": "Nose Gear Static", "Days": 85, "Status": "Upcoming"}]}

Question: "List components with low MOS"
Response: {"rows": [{"Component": "Brake Assembly", "MOS": 0.24, "Location": "Main Gear"}, {"Component": "Wing Spar Outboard", "MOS": 0.21, "Location": "Wing"}]}

Question: "List all NDAs expiring in 2025"
Response: {"rows": [{"Company": "Acme Aerospace", "Expires": "2025-08-15", "Days": 253}, {"Company": "Global Avionics", "Expires": "2025-06-30", "Days": 207}]}""",
        "schema": {
            "rows": "array of objects with consistent columns"
        }
    },

    "text": {
        "system": """You are a data extraction assistant for dashboard text summaries.
The user will ask for a summary or explanation.

You MUST respond with ONLY valid JSON in this exact format:
{
  "summary": "<brief markdown-formatted text>",
  "keyFacts": ["<fact1>", "<fact2>", "<fact3>"]
}

Rules:
1. Search the documents using available tools
2. Provide a brief summary (2-4 sentences max)
3. Use markdown for emphasis (**, *, etc)
4. Include 2-5 key facts as bullet points
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "Summarize budget status"
Response: {"summary": "**Budget Status**: Project is 3.4% over budget at $3,515,000 vs $3,400,000 planned. Manufacturing is the primary concern, running 12.5% over budget.", "keyFacts": ["Total variance: -$115,000", "Manufacturing: -$150,000 (12.5% over)", "Engineering: $15,000 under budget"]}

Question: "Summarize test readiness"
Response: {"summary": "**Test Readiness**: 2 tests due within 90 days require immediate preparation.", "keyFacts": ["Main Gear Static: 45 days (Critical)", "Nose Gear Static: 85 days (On track)", "Wing Spar Static: 125 days (Planned)"]}""",
        "schema": {
            "summary": "string (markdown formatted)",
            "keyFacts": "array of strings"
        }
    },

    "date": {
        "system": """You are a data extraction assistant for dashboard date displays.
The user will ask for specific dates or date ranges.

You MUST respond with ONLY valid JSON in this exact format:
{
  "date": "<YYYY-MM-DD>",
  "label": "<short label>",
  "daysUntil": <number or null>
}

Rules:
1. Search the documents using available tools
2. Extract the specific date requested
3. Calculate days until that date from CURRENT DATE (provided above)
4. Use positive numbers for future dates, negative for past dates
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "When does the Acme Aerospace NDA expire?"
Response: {"date": "2025-08-15", "label": "Acme Aerospace NDA", "daysUntil": 253}

Question: "When is the main gear static test?"
Response: {"date": "2025-02-18", "label": "Main Gear Static Test", "daysUntil": 45}

Question: "What is the PDR date?"
Response: {"date": "2025-03-15", "label": "PDR", "daysUntil": 70}""",
        "schema": {
            "date": "string (ISO date YYYY-MM-DD)",
            "label": "string",
            "daysUntil": "number or null"
        }
    },

    "color": {
        "system": """You are a data extraction assistant for dashboard status indicators.
The user will ask about status or health of something.

You MUST respond with ONLY valid JSON in this exact format:
{
  "color": "green|yellow|red",
  "label": "<status label>",
  "message": "<brief explanation>"
}

Color meanings:
- "green": Good status, no issues, passing, within limits
- "yellow": Warning, needs attention, marginal, approaching limits
- "red": Critical, failing, immediate action required, exceeded limits

Evaluation Guidelines:
- For MOS (Margin of Safety):
  - Green: MOS >= 0.25
  - Yellow: 0.15 <= MOS < 0.25
  - Red: MOS < 0.15

- For expirations:
  - Green: > 90 days until expiration
  - Yellow: 30-90 days until expiration
  - Red: < 30 days or already expired

- For budget:
  - Green: Within budget or < 3% over
  - Yellow: 3-10% over budget
  - Red: > 10% over budget

Rules:
1. Search the documents using available tools
2. Extract relevant values (MOS, dates, budget numbers)
3. Evaluate against thresholds using CURRENT DATE
4. Choose appropriate color
5. Return ONLY the JSON object (no markdown, no explanation)

Examples:
Question: "What is the status of the brake assembly?"
Response: {"color": "yellow", "label": "Main Gear Brake Assembly", "message": "MOS 0.24 is below preferred 0.25"}

Question: "What is the budget health?"
Response: {"color": "yellow", "label": "Project Budget", "message": "3.4% over budget (-$115,000)"}

Question: "What is the Acme NDA status?"
Response: {"color": "yellow", "label": "Acme Aerospace NDA", "message": "Expires 2025-08-15 (253 days)"}""",
        "schema": {
            "color": "green|yellow|red",
            "label": "string",
            "message": "string"
        }
    }
}


def create_llm_request(question: str, tile_type: str) -> Dict[str, Any]:
    """
    Create an LLM request with the appropriate prompt for the tile type
    Injects current date for time-based calculations
    """
    if tile_type not in TILE_SCHEMAS:
        tile_type = "text"  # Default fallback

    schema_config = TILE_SCHEMAS[tile_type]

    # Inject current date into system prompt
    from datetime import datetime
    current_date = datetime.now().strftime("%Y-%m-%d")

    system_prompt_with_date = f"""CURRENT DATE: {current_date}

{schema_config["system"]}

Important: Use the current date ({current_date}) for all time-based calculations (days until, expiring soon, etc)."""

    return {
        "system_prompt": system_prompt_with_date,
        "user_question": question,
        "expected_schema": schema_config["schema"]
    }


def parse_llm_response(response: str, expected_schema: Dict[str, Any], tile_type: str) -> Dict[str, Any]:
    """
    Parse LLM response (JSON) and format for visualization
    All responses should now be JSON objects
    """
    response = response.strip()

    # Extract JSON from response - find first complete JSON object
    json_str = None

    # First check for markdown code block
    if '```' in response:
        code_block_match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', response)
        if code_block_match:
            json_str = code_block_match.group(1)

    # If no code block, find first { and match braces to get complete object
    if not json_str:
        start_idx = response.find('{')
        if start_idx != -1:
            brace_count = 0
            in_string = False
            escape_next = False

            for i in range(start_idx, len(response)):
                char = response[i]

                if escape_next:
                    escape_next = False
                    continue

                if char == '\\':
                    escape_next = True
                    continue

                if char == '"' and not escape_next:
                    in_string = not in_string
                    continue

                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_str = response[start_idx:i+1]
                            break

    if not json_str:
        return {
            "success": False,
            "error": f"No valid JSON found in response: {response[:200]}"
        }

    try:
        # Parse JSON response
        data = json.loads(json_str)

        # Format based on tile type
        if tile_type == "counter":
            if "value" not in data:
                return {"success": False, "error": "Counter response must have 'value' field"}

            return {
                "success": True,
                "result": {
                    "type": "counter",
                    "value": data["value"],
                    "label": data.get("label", ""),
                    "subtitle": data.get("unit", "")
                }
            }

        elif tile_type == "counter_warning":
            if "value" not in data:
                return {"success": False, "error": "Counter warning response must have 'value' field"}

            # Map severity to level
            severity_map = {"low": "success", "medium": "warning", "high": "danger"}
            level = severity_map.get(data.get("severity", "low"), "success")

            return {
                "success": True,
                "result": {
                    "type": "counter_warning",
                    "value": data["value"],
                    "label": data.get("label", ""),
                    "level": level,
                    "items": data.get("items", [])
                }
            }

        elif tile_type == "graph":
            if "labels" not in data or "values" not in data:
                return {"success": False, "error": "Graph data must have 'labels' and 'values' fields"}

            return {
                "success": True,
                "result": {
                    "type": "graph",
                    "chartType": "bar",  # Default, can be overridden
                    "data": {
                        "labels": data["labels"],
                        "values": data["values"]
                    },
                    "title": data.get("title", "")
                }
            }

        elif tile_type == "table":
            if "rows" not in data:
                return {"success": False, "error": "Table data must have 'rows' field"}

            rows = data["rows"]
            if len(rows) == 0:
                return {
                    "success": True,
                    "result": {
                        "type": "table",
                        "columns": [],
                        "rows": [],
                        "totalRows": 0
                    }
                }

            columns = list(rows[0].keys())

            return {
                "success": True,
                "result": {
                    "type": "table",
                    "columns": columns,
                    "rows": rows,
                    "totalRows": len(rows)
                }
            }

        elif tile_type == "text":
            if "summary" not in data:
                return {"success": False, "error": "Text response must have 'summary' field"}

            # Format with key facts as bullet points
            content = data["summary"]
            if "keyFacts" in data and data["keyFacts"]:
                content += "\n\n**Key Facts:**\n"
                for fact in data["keyFacts"]:
                    content += f"- {fact}\n"

            return {
                "success": True,
                "result": {
                    "type": "text",
                    "content": content,
                    "format": "markdown"
                }
            }

        elif tile_type == "date":
            if "date" not in data:
                return {"success": False, "error": "Date response must have 'date' field"}

            return {
                "success": True,
                "result": {
                    "type": "date",
                    "date": data["date"],
                    "label": data.get("label", ""),
                    "daysUntil": data.get("daysUntil")
                }
            }

        elif tile_type == "color":
            if "color" not in data:
                return {"success": False, "error": "Color response must have 'color' field"}

            return {
                "success": True,
                "result": {
                    "type": "color",
                    "color": data["color"],
                    "label": data.get("label", ""),
                    "message": data.get("message", "")
                }
            }

        else:
            return {"success": False, "error": f"Unknown tile type: {tile_type}"}

    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"Invalid JSON in response: {e}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error parsing response: {e}"
        }


def handle_dashboard_query(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main tool: Takes a question and tile type, returns LLM request config
    The Electron app will call the LLM and return the response
    """
    question = args.get('question', '')
    tile_type = args.get('tileType', 'counter')

    if not question:
        return {
            "success": False,
            "error": "No question provided"
        }

    # Create the LLM request configuration
    llm_request = create_llm_request(question, tile_type)

    return {
        "success": True,
        "llm_request": llm_request,
        "tile_type": tile_type
    }


def handle_format_response(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool: Takes LLM response (JSON) and formats it for visualization
    """
    llm_response = args.get('llmResponse', '')
    expected_schema = args.get('expectedSchema', {})
    tile_type = args.get('tileType', 'counter')

    return parse_llm_response(llm_response, expected_schema, tile_type)


# MCP Server Implementation
def handle_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Route tool calls to appropriate handlers"""
    handlers = {
        "create_dashboard_query": handle_dashboard_query,
        "format_llm_response": handle_format_response,
    }

    handler = handlers.get(tool_name)
    if not handler:
        return {"error": f"Unknown tool: {tool_name}"}

    return handler(arguments)


def main():
    """Main MCP server loop"""
    print("Dashboard Prompt Manager starting...", file=sys.stderr)

    # MCP tool definitions
    tools = [
        {
            "name": "create_dashboard_query",
            "description": "Creates a structured LLM request for a dashboard tile. Returns system prompt and expected format based on tile type.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The question to ask (e.g., 'What is the main gear MOS?')"
                    },
                    "tileType": {
                        "type": "string",
                        "enum": ["counter", "counter_warning", "graph", "table", "text", "date", "color"],
                        "description": "Type of visualization tile"
                    }
                },
                "required": ["question", "tileType"]
            }
        },
        {
            "name": "format_llm_response",
            "description": "Formats an LLM response for visualization based on expected format",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "llmResponse": {
                        "type": "string",
                        "description": "The raw LLM response text"
                    },
                    "expectedSchema": {
                        "type": "object",
                        "description": "Expected JSON schema of the response"
                    },
                    "tileType": {
                        "type": "string",
                        "description": "Type of tile (for additional formatting)"
                    }
                },
                "required": ["llmResponse", "expectedSchema", "tileType"]
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
                "version": "2.0.0"
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
