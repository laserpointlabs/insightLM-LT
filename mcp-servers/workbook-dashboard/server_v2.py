#!/usr/bin/env python3
"""
Dashboard MCP Server - Prompt Manager for Structured Visualizations
This server manages prompts and formats LLM responses for different tile types.
It does NOT read files or couple with other MCP servers.
"""
import os
import sys
import json
from typing import Dict, Any, Optional

# Prompt templates for each tile type
TILE_PROMPTS = {
    "counter": {
        "system": """You are a data extraction assistant for dashboard counters.
The user will ask a question about their documents.
You must:
1. Search the documents using available tools
2. Extract the specific numeric value requested
3. Return ONLY a single number (no units, no explanation, no formatting)
4. If you cannot find a specific number, return "N/A"

Examples:
- Question: "What is the main gear brake assembly MOS?"
  Response: 0.24

- Question: "How many tests are due within 90 days?"
  Response: 2

- Question: "What is the manufacturing budget variance?"
  Response: -150000""",
        "format": "single_number"
    },

    "counter_warning": {
        "system": """You are a data extraction assistant for dashboard warning counters.
The user will ask a question about items that may need attention.
You must:
1. Search the documents using available tools
2. Count items that match the warning criteria (e.g., expiring soon, below threshold)
3. Return ONLY the count as a number
4. If zero items match, return "0"

Examples:
- Question: "How many NDAs are expiring within 90 days?"
  Response: 2

- Question: "How many components have MOS below 0.25?"
  Response: 2""",
        "format": "single_number"
    },

    "graph": {
        "system": """You are a data extraction assistant for dashboard charts.
The user will ask for data to visualize.
You must:
1. Search the documents using available tools
2. Extract the relevant data
3. Return data in JSON format: {"labels": [...], "values": [...]}
4. Labels should be strings, values should be numbers
5. Return ONLY the JSON object, no explanation

Examples:
- Question: "Show document types breakdown"
  Response: {"labels": ["PDF", "Markdown", "CSV"], "values": [0, 11, 1]}

- Question: "Show tests by days until due"
  Response: {"labels": ["Main Gear", "Nose Gear", "Wing Spar"], "values": [45, 85, 125]}""",
        "format": "json_chart_data"
    },

    "table": {
        "system": """You are a data extraction assistant for dashboard tables.
The user will ask for a list of items.
You must:
1. Search the documents using available tools
2. Extract the relevant items
3. Return data as JSON array: [{"col1": "val1", "col2": "val2"}, ...]
4. Each object is one table row
5. Return ONLY the JSON array, no explanation

Examples:
- Question: "List all tests due soon"
  Response: [{"test": "Main Gear Static", "days": 45, "status": "Due Soon"}, {"test": "Nose Gear Static", "days": 85, "status": "Upcoming"}]

- Question: "List components with low MOS"
  Response: [{"component": "Brake Assembly", "mos": 0.24, "location": "Main Gear"}, {"component": "Wing Spar Outboard", "mos": 0.21, "location": "Wing"}]""",
        "format": "json_table_data"
    },

    "text": {
        "system": """You are a data extraction assistant for dashboard text summaries.
The user will ask for a summary or explanation.
You must:
1. Search the documents using available tools
2. Provide a brief, informative summary
3. Use markdown formatting for emphasis
4. Keep it concise (2-4 sentences)
5. Include key numbers and facts

Examples:
- Question: "Summarize budget status"
  Response: **Budget Status**: Project is 3.4% over budget at $3,515,000 vs $3,400,000 planned. Manufacturing is the primary concern, running 12.5% over budget at $150,000 overspend.

- Question: "Summarize test readiness"
  Response: **Test Readiness**: 2 tests due within 90 days. Main Gear Static Test in 45 days requires immediate action. Nose Gear Static Test in 85 days is on track.""",
        "format": "markdown_text"
    }
}


def create_llm_request(question: str, tile_type: str) -> Dict[str, Any]:
    """
    Create an LLM request with the appropriate prompt for the tile type
    """
    if tile_type not in TILE_PROMPTS:
        tile_type = "text"  # Default fallback

    prompt_config = TILE_PROMPTS[tile_type]

    return {
        "system_prompt": prompt_config["system"],
        "user_question": question,
        "expected_format": prompt_config["format"]
    }


def parse_llm_response(response: str, expected_format: str, tile_type: str) -> Dict[str, Any]:
    """
    Parse LLM response and format for visualization
    """
    response = response.strip()

    try:
        if expected_format == "single_number":
            # Try to extract a number
            if response.lower() == "n/a":
                return {
                    "success": True,
                    "result": {
                        "type": tile_type,
                        "value": "N/A",
                        "label": "",
                        "subtitle": "Data not available"
                    }
                }

            # Extract number from response
            import re
            numbers = re.findall(r'-?\d+\.?\d*', response)
            if numbers:
                value = float(numbers[0]) if '.' in numbers[0] else int(numbers[0])

                # Determine warning level for counter_warning
                level = "success"
                if tile_type == "counter_warning" and value > 0:
                    if value >= 5:
                        level = "danger"
                    elif value >= 2:
                        level = "warning"

                return {
                    "success": True,
                    "result": {
                        "type": tile_type,
                        "value": value,
                        "label": "",
                        "subtitle": "",
                        **({"level": level} if tile_type == "counter_warning" else {})
                    }
                }
            else:
                return {
                    "success": False,
                    "error": f"Could not extract number from response: {response}"
                }

        elif expected_format == "json_chart_data":
            # Parse JSON for chart data
            data = json.loads(response)
            if "labels" not in data or "values" not in data:
                return {
                    "success": False,
                    "error": "Chart data must have 'labels' and 'values' fields"
                }

            return {
                "success": True,
                "result": {
                    "type": "graph",
                    "chartType": "bar",  # Default, can be overridden
                    "data": data
                }
            }

        elif expected_format == "json_table_data":
            # Parse JSON for table data
            data = json.loads(response)
            if not isinstance(data, list) or len(data) == 0:
                return {
                    "success": False,
                    "error": "Table data must be a non-empty array of objects"
                }

            columns = list(data[0].keys())

            return {
                "success": True,
                "result": {
                    "type": "table",
                    "columns": columns,
                    "rows": data,
                    "totalRows": len(data)
                }
            }

        elif expected_format == "markdown_text":
            return {
                "success": True,
                "result": {
                    "type": "text",
                    "content": response,
                    "format": "markdown"
                }
            }

        else:
            return {
                "success": False,
                "error": f"Unknown format: {expected_format}"
            }

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
    Tool: Takes LLM response and formats it for visualization
    """
    llm_response = args.get('llmResponse', '')
    expected_format = args.get('expectedFormat', 'single_number')
    tile_type = args.get('tileType', 'counter')

    return parse_llm_response(llm_response, expected_format, tile_type)


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
                        "enum": ["counter", "counter_warning", "graph", "table", "text"],
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
                    "expectedFormat": {
                        "type": "string",
                        "enum": ["single_number", "json_chart_data", "json_table_data", "markdown_text"],
                        "description": "Expected format of the response"
                    },
                    "tileType": {
                        "type": "string",
                        "description": "Type of tile (for additional formatting)"
                    }
                },
                "required": ["llmResponse", "expectedFormat", "tileType"]
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
