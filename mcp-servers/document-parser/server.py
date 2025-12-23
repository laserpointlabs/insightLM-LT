#!/usr/bin/env python3
"""
Document Parser MCP Server
Extracts text from PDF, DOCX, and other formats
"""
import json
import sys
from typing import Dict, Any

def handle_request(request: Dict[str, Any]) -> Dict[str, Any]:
    """Handle MCP request"""
    method = request.get('method', '')
    params = request.get('params', {})
    request_id = request.get('id')

    try:
        if method == 'initialize':
            # MCP protocol initialization
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'protocolVersion': '2024-11-05',
                    'capabilities': {
                        'tools': {
                            'listChanged': True
                        }
                    },
                    'serverInfo': {
                        'name': 'document-parser',
                        'version': '0.1.0'
                    }
                }
            }
        
        elif method == 'tools/list':
            # List available tools
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'tools': [
                        {
                            'name': 'parse_pdf',
                            'description': 'Extract text from a PDF file',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'file_path': {'type': 'string', 'description': 'Path to PDF file'}
                                },
                                'required': ['file_path']
                            }
                        },
                        {
                            'name': 'parse_docx',
                            'description': 'Extract text from a DOCX file',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'file_path': {'type': 'string', 'description': 'Path to DOCX file'}
                                },
                                'required': ['file_path']
                            }
                        }
                    ]
                }
            }
        
        elif method == 'tools/call':
            # Handle tool calls
            tool_name = params.get('name', '')
            tool_args = params.get('arguments', {})
            
            if tool_name == 'parse_pdf':
                file_path = tool_args.get('file_path', '')
                # TODO: Implement actual PDF parsing
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {'text': '', 'metadata': {'file_path': file_path}}
                }
            
            elif tool_name == 'parse_docx':
                file_path = tool_args.get('file_path', '')
                # TODO: Implement actual DOCX parsing
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {'text': '', 'metadata': {'file_path': file_path}}
                }
            
            else:
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'error': {
                        'code': -32601,
                        'message': f'Unknown tool: {tool_name}'
                    }
                }

        # Legacy methods (backward compatibility)
        elif method == 'parse/pdf':
            file_path = params.get('file_path', '')
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {'text': '', 'metadata': {'file_path': file_path}}
            }
        
        elif method == 'parse/docx':
            file_path = params.get('file_path', '')
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {'text': '', 'metadata': {'file_path': file_path}}
            }
        
        else:
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'error': {
                    'code': -32601,
                    'message': f'Unknown method: {method}'
                }
            }

    except Exception as e:
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {
                'code': -32603,
                'message': str(e)
            }
        }

if __name__ == '__main__':
    # Send initialization message on startup
    init_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "2024-11-05",
            "serverInfo": {
                "name": "document-parser",
                "version": "0.1.0"
            },
            "capabilities": {
                "tools": {
                    "listChanged": True
                }
            }
        }
    }
    print(json.dumps(init_response), flush=True)
    
    # Handle requests
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            response = handle_request(request)
            if response:
                print(json.dumps(response), flush=True)
        except Exception as e:
            error_response = {
                'jsonrpc': '2.0',
                'id': request.get('id') if 'request' in locals() else None,
                'error': {
                    'code': -32603,
                    'message': str(e)
                }
            }
            print(json.dumps(error_response), flush=True)
