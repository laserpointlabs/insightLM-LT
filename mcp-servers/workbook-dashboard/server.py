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

# Tile type schemas for validation (format-agnostic - no LLM prompts)
TILE_SCHEMAS = {
    "counter": {
        "schema": {
            "value": "number or null",
            "label": "string",
            "unit": "string (optional)"
        }
    },

    "counter_warning": {
        "schema": {
            "value": "number",
            "label": "string",
            "severity": "low|medium|high",
            "items": "array of strings"
        }
    },

    "graph": {
        "schema": {
            "labels": "array of strings",
            "values": "array of numbers",
            "title": "string"
        }
    },

    "table": {
        "schema": {
            "rows": "array of objects with consistent columns"
        }
    },

    "text": {
        "schema": {
            "summary": "string (markdown formatted)",
            "keyFacts": "array of strings"
        }
    },

    "date": {
        "schema": {
            "date": "string (ISO date YYYY-MM-DD)",
            "label": "string",
            "daysUntil": "number or null"
        }
    },

    "color": {
        "schema": {
            "color": "green|yellow|red",
            "label": "string",
            "message": "string"
        }
    }
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




def handle_format_response(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tool: Takes LLM response (JSON) and formats it for dashboard visualization
    This is now the only tool - pure formatter, no prompt creation
    """
    llm_response = args.get('llmResponse', '')
    tile_type = args.get('tileType', 'counter')

    # For format-agnostic operation, we don't need expected_schema
    # The parse_llm_response function can infer validation from tile_type
    return parse_llm_response(llm_response, {}, tile_type)


# MCP Server Implementation
def handle_tool_call(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Route tool calls to appropriate handlers"""
    handlers = {
        "format_llm_response": handle_format_response,
    }

    handler = handlers.get(tool_name)
    if not handler:
        return {"error": f"Unknown tool: {tool_name}"}

    return handler(arguments)


def main():
    """Main MCP server loop"""
    print("Dashboard Prompt Manager starting...", file=sys.stderr)

    # MCP tool definitions - now format-agnostic
    tools = [
        {
            "name": "format_llm_response",
            "description": "Formats an LLM response for dashboard visualization based on tile type. Pure formatter that doesn't create prompts.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "llmResponse": {
                        "type": "string",
                        "description": "The raw LLM response text (JSON)"
                    },
                    "tileType": {
                        "type": "string",
                        "enum": ["counter", "counter_warning", "graph", "table", "text", "date", "color"],
                        "description": "Type of visualization tile for formatting"
                    }
                },
                "required": ["llmResponse", "tileType"]
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
            request = json.loads(line.strip())
            method = request.get('method')
            request_id = request.get('id')

            if method == 'tools/list':
                # Return list of available tools
                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "tools": tools
                    }
                }
                print(json.dumps(response), flush=True)

            elif method == 'tools/call':
                params = request.get('params', {})
                tool_name = params.get('name')
                arguments = params.get('arguments', {})

                result = handle_tool_call(tool_name, arguments)

                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": result
                }
                print(json.dumps(response), flush=True)

            else:
                # Unknown method
                error_response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32601,
                        "message": f"Unknown method: {method}"
                    }
                }
                print(json.dumps(error_response), flush=True)

        except Exception as e:
            import traceback
            error_response = {
                "jsonrpc": "2.0",
                "id": request.get('id') if 'request' in locals() else None,
                "error": {
                    "code": -32603,
                    "message": str(e),
                    "data": traceback.format_exc() if __debug__ else None
                }
            }
            print(json.dumps(error_response), flush=True)


if __name__ == "__main__":
    main()
