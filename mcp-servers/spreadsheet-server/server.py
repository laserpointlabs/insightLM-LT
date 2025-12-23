#!/usr/bin/env python3
"""
Spreadsheet MCP Server - Formula Calculation Engine
Provides Excel-like formula calculation using Python backend.
All formulas are visible in RAG context (no hidden equations).
"""
import os
import sys
import json
import re
from typing import Dict, Any, Optional, List

try:
    from pycel import ExcelCompiler
    PYCEL_AVAILABLE = True
except ImportError:
    PYCEL_AVAILABLE = False
    print("Warning: pycel not available, using basic formula evaluation", file=sys.stderr)

# Get data directory from environment
DATA_DIR = os.environ.get("INSIGHTLM_DATA_DIR", "")

def get_data_dir() -> str:
    """Get application data directory"""
    if DATA_DIR:
        return DATA_DIR

    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            return str(os.path.join(appdata, "insightLM-LT"))
    else:
        home = os.environ.get("HOME", "")
        if home:
            return str(os.path.join(home, ".config", "insightLM-LT"))

    raise ValueError("Could not determine data directory")


def extract_cell_references(formula: str) -> List[str]:
    """Extract cell references from a formula (e.g., A1, B2, etc.)"""
    if not formula.startswith("="):
        return []
    
    # Pattern to match cell references like A1, B2, AA10, etc.
    pattern = r'\b([A-Z]+)(\d+)\b'
    matches = re.findall(pattern, formula)
    return [f"{col}{row}" for col, row in matches]


def calculate_cell(formula: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate a cell value from a formula using pycel or basic evaluation.
    
    Args:
        formula: Excel-style formula (e.g., "=A1*2")
        context: Dictionary of cell values (e.g., {"A1": 100})
    
    Returns:
        Dictionary with value, error, and dependencies
    """
    if not formula.startswith("="):
        # Not a formula, return as-is
        return {
            "value": formula,
            "error": None,
            "dependencies": []
        }
    
    # Extract dependencies
    dependencies = extract_cell_references(formula)
    
    # Check if all dependencies are available
    missing_deps = [dep for dep in dependencies if dep not in context]
    if missing_deps:
        return {
            "value": None,
            "error": f"Missing cell references: {', '.join(missing_deps)}",
            "dependencies": dependencies
        }
    
    # Try pycel first if available
    if PYCEL_AVAILABLE:
        try:
            # Create a simple ExcelCompiler with the context
            # Note: pycel expects a workbook-like structure, so we create a minimal one
            compiler = ExcelCompiler()
            
            # Add cells to compiler
            for cell_ref, value in context.items():
                # Convert cell reference to ExcelCompiler format
                compiler.set_value(cell_ref, value)
            
            # Compile and evaluate the formula
            result = compiler.evaluate(formula)
            
            return {
                "value": result,
                "error": None,
                "dependencies": dependencies
            }
        except Exception as e:
            # Fall back to basic evaluation if pycel fails
            pass
    
    # Basic formula evaluation (fallback)
    try:
        # Remove leading =
        formula_body = formula[1:].strip()
        
        # Replace cell references with their values
        # This is a simple approach - pycel handles this better
        for cell_ref, value in context.items():
            # Replace cell references in formula
            formula_body = re.sub(rf'\b{cell_ref}\b', str(value), formula_body)
        
        # Safe evaluation (still not perfect, but better than eval)
        # Only allow basic arithmetic operations
        allowed_chars = set('0123456789+-*/()., ')
        if all(c in allowed_chars for c in formula_body):
            result = eval(formula_body, {"__builtins__": {}}, {})
            return {
                "value": result,
                "error": None,
                "dependencies": dependencies
            }
        else:
            return {
                "value": None,
                "error": "Complex formulas require pycel",
                "dependencies": dependencies
            }
    except Exception as e:
        return {
            "value": None,
            "error": str(e),
            "dependencies": dependencies
        }


def handle_request(request: dict) -> dict:
    """Handle MCP requests"""
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
                        'name': 'spreadsheet-server',
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
                            'name': 'calculate_cell',
                            'description': 'Calculate a spreadsheet cell formula with context',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'formula': {'type': 'string', 'description': 'Cell formula to calculate'},
                                    'context': {'type': 'object', 'description': 'Cell values for formula context'}
                                },
                                'required': ['formula']
                            }
                        },
                        {
                            'name': 'get_sheet_data_for_rag',
                            'description': 'Get spreadsheet data formatted for RAG indexing (formulas visible)',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'sheet_id': {'type': 'string', 'description': 'Sheet identifier'},
                                    'workbook_id': {'type': 'string', 'description': 'Workbook identifier'},
                                    'filename': {'type': 'string', 'description': 'Spreadsheet filename'}
                                },
                                'required': ['sheet_id', 'workbook_id', 'filename']
                            }
                        }
                    ]
                }
            }
        
        elif method == 'tools/call':
            # Handle tool calls
            tool_name = params.get('name', '')
            tool_args = params.get('arguments', {})
            
            if tool_name == 'calculate_cell':
                formula = tool_args.get('formula', '')
                context = tool_args.get('context', {})
                result = calculate_cell(formula, context)
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': result
                }
            
            elif tool_name == 'get_sheet_data_for_rag':
                sheet_id = tool_args.get('sheet_id', '')
                workbook_id = tool_args.get('workbook_id', '')
                filename = tool_args.get('filename', '')
                
                # TODO: Load actual spreadsheet data
                text_content = f"Spreadsheet: {filename}\n\n"
                text_content += "Formulas are visible in this context (no hidden equations).\n"
                
                result = {
                    'text_content': text_content,
                    'formulas': {},
                    'metadata': {
                        'workbook_id': workbook_id,
                        'filename': filename,
                        'sheet_name': sheet_id
                    }
                }
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': result
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
        elif method == 'spreadsheet/calculate_cell':
            sheet_id = params.get('sheet_id', '')
            cell_ref = params.get('cell_ref', '')
            formula = params.get('formula', '')
            context = params.get('context', {})
            
            result = calculate_cell(formula, context)
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': result
            }

        elif method == 'spreadsheet/get_cell':
            # TODO: Implement cell retrieval from stored spreadsheet
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {'value': None, 'formula': None, 'format': None}
            }

        elif method == 'spreadsheet/set_cell':
            # TODO: Implement cell setting and dependency recalculation
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {'success': True, 'recalculated_cells': []}
            }

        elif method == 'spreadsheet/recalculate':
            # TODO: Implement full sheet recalculation
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {'success': True, 'cells_updated': []}
            }

        elif method == 'spreadsheet/get_sheet_data':
            # TODO: Implement sheet data retrieval
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {'cells': {}, 'formulas': {}, 'metadata': {}}
            }

        elif method == 'spreadsheet/get_sheet_data_for_rag':
            sheet_id = params.get('sheet_id', '')
            workbook_id = params.get('workbook_id', '')
            filename = params.get('filename', '')
            
            text_content = f"Spreadsheet: {filename}\n\n"
            text_content += "Formulas are visible in this context (no hidden equations).\n"
            
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'text_content': text_content,
                    'formulas': {},
                    'metadata': {
                        'workbook_id': workbook_id,
                        'filename': filename,
                        'sheet_name': sheet_id
                    }
                }
            }

        elif method == 'spreadsheet/health':
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {'status': 'healthy', 'mode': 'formula-calculation'}
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
                "name": "spreadsheet-server",
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
    
    # MCP stdio protocol
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
