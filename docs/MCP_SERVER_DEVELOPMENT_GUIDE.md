# MCP Server Development Guide

## Overview

This guide explains how to create and integrate MCP (Model Context Protocol) servers into the InsightLM-LT system. MCP servers provide tools and capabilities to the LLM service through a standardized JSON-RPC protocol.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Server    │───▶│  ToolRegistry   │───▶│   LLM Service   │
│ (Python/Node.js)│    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   JSON-RPC over            Dynamic tool             Tool execution
   stdio                    discovery               routing
```

## MCP Server Requirements

### 1. JSON-RPC Protocol
All MCP servers must:
- Use JSON-RPC 2.0 protocol
- Include `id` in all requests/responses
- Include `jsonrpc: "2.0"` field
- Send initialization message on startup

### 2. Standard Methods
Implement these required methods:

#### `initialize`
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {
        "listChanged": true
      }
    },
    "clientInfo": {
      "name": "insightlm-lt",
      "version": "1.0.0"
    }
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {
        "listChanged": true
      }
    },
    "serverInfo": {
      "name": "your-server-name",
      "version": "1.0.0"
    }
  }
}
```

#### `tools/list`
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "your_tool_name",
        "description": "What this tool does",
        "inputSchema": {
          "type": "object",
          "properties": {
            "param1": {
              "type": "string",
              "description": "Parameter description"
            }
          },
          "required": ["param1"]
        }
      }
    ]
  }
}
```

#### `tools/call`
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "your_tool_name",
    "arguments": {
      "param1": "value"
    }
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool execution result"
      }
    ]
  }
}
```

## Python MCP Server Template

```python
#!/usr/bin/env python3
"""
MCP Server Template for InsightLM-LT
"""
import sys
import json
import asyncio
from typing import Dict, Any, List

class YourMCPServer:
    def __init__(self):
        self.tools = [
            {
                "name": "your_tool_name",
                "description": "What this tool does",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "param1": {
                            "type": "string",
                            "description": "Parameter description"
                        }
                    },
                    "required": ["param1"]
                }
            }
        ]

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming JSON-RPC requests"""

        method = request.get("method")
        request_id = request.get("id")

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {
                            "listChanged": True
                        }
                    },
                    "serverInfo": {
                        "name": "your-server-name",
                        "version": "1.0.0"
                    }
                }
            }

        elif method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "tools": self.tools
                }
            }

        elif method == "tools/call":
            return await self.handle_tool_call(request)

        else:
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {
                    "code": -32601,
                    "message": f"Method not found: {method}"
                }
            }

    async def handle_tool_call(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tool execution"""
        params = request.get("params", {})
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        if tool_name == "your_tool_name":
            # Implement your tool logic here
            result = f"Tool executed with param1: {arguments.get('param1', 'default')}"

            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": result
                        }
                    ]
                }
            }

        return {
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "error": {
                "code": -32602,
                "message": f"Tool not found: {tool_name}"
            }
        }

async def main():
    """Main server loop"""
    server = YourMCPServer()

    # Send initialization message
    init_message = {
        "jsonrpc": "2.0",
        "method": "initialized",
        "params": {}
    }
    print(json.dumps(init_message), flush=True)

    try:
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                response = await server.handle_request(request)
                print(json.dumps(response), flush=True)
            except json.JSONDecodeError:
                continue
            except Exception as e:
                error_response = {
                    "jsonrpc": "2.0",
                    "id": request.get("id") if 'request' in locals() else None,
                    "error": {
                        "code": -32000,
                        "message": f"Server error: {str(e)}"
                    }
                }
                print(json.dumps(error_response), flush=True)
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    asyncio.run(main())
```

## Server Configuration

### Directory Structure
```
mcp-servers/
├── your-server-name/
│   ├── server.py           # Main server script
│   ├── config.json         # Server configuration
│   ├── requirements.txt    # Python dependencies (optional)
│   └── README.md          # Server documentation
```

### config.json Format
```json
{
  "name": "your-server-name",
  "description": "What this server provides",
  "command": "python",
  "args": ["server.py"],
  "enabled": true
}
```

### Extension Integration
If your server is managed by an extension:

```json
{
  "name": "your-server-name",
  "description": "Extension-managed server",
  "command": "python",
  "args": ["server.py"],
  "enabled": false,
  "managedByExtension": "your-extension-id"
}
```

## Tool Naming Conventions

### Consistent Naming
- Use `snake_case` for tool names
- Include domain prefix: `document_parse_pdf`, `spreadsheet_calculate`
- Make names descriptive but concise

### Input Schema Best Practices
```json
{
  "name": "document_parse_pdf",
  "description": "Extract text content from PDF files",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": {
        "type": "string",
        "description": "Path to the PDF file"
      },
      "extract_metadata": {
        "type": "boolean",
        "description": "Whether to include metadata",
        "default": false
      }
    },
    "required": ["file_path"]
  }
}
```

## Error Handling

### Standard Error Codes
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32000`: Server error (custom)

### Error Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "error": {
    "code": -32000,
    "message": "File not found",
    "data": {
      "file_path": "/path/to/missing/file"
    }
  }
}
```

## Testing Your Server

### Manual Testing
```bash
# Test basic functionality
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}' | python server.py

# Test tools/list
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}' | python server.py
```

### Integration Testing
Add your server to `tests/test-mcp-tool-discovery.mjs` to verify:
- Server starts correctly
- Tools are discovered
- Tool execution works
- Tools are unregistered on server stop

## Best Practices

### 1. Idempotent Operations
Tools should be safe to call multiple times with same inputs.

### 2. Input Validation
Validate all input parameters before processing.

### 3. Error Recovery
Handle failures gracefully and provide meaningful error messages.

### 4. Resource Management
Clean up resources (file handles, connections) properly.

### 5. Logging
Use appropriate log levels and include context in log messages.

### 6. Documentation
Document all tools with clear descriptions and parameter details.

## Common Patterns

### File Processing Tools
```python
def validate_file_path(self, file_path: str) -> bool:
    """Validate file exists and is accessible"""
    return os.path.isfile(file_path) and os.access(file_path, os.R_OK)

async def handle_tool_call(self, request):
    params = request.get("params", {})
    file_path = params.get("arguments", {}).get("file_path")

    if not self.validate_file_path(file_path):
        return {
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "error": {
                "code": -32602,
                "message": f"Invalid or inaccessible file: {file_path}"
            }
        }

    # Process file...
```

### Configuration-Based Tools
```python
def __init__(self):
    self.config = self.load_config()
    self.tools = self.build_tools_from_config()

def build_tools_from_config(self) -> List[Dict]:
    """Dynamically build tools from configuration"""
    tools = []
    for operation in self.config.get("operations", []):
        tools.append({
            "name": operation["name"],
            "description": operation["description"],
            "inputSchema": operation["schema"]
        })
    return tools
```

## Troubleshooting

### Server Won't Start
- Check file permissions
- Verify Python/Node.js dependencies
- Check for syntax errors in server code
- Ensure config.json is valid

### Tools Not Discovered
- Verify `tools/list` method returns valid JSON
- Check initialization message is sent
- Ensure server sends `initialized` notification

### Tool Execution Fails
- Validate input parameters
- Check error handling in tool implementation
- Verify server has necessary permissions
- Check for async/await issues

### Memory/Resource Issues
- Implement proper cleanup in tool execution
- Monitor for file handle leaks
- Check for infinite loops or recursion
- Profile memory usage in long-running operations















