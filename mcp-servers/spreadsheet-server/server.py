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

    try:
        if method == 'spreadsheet/calculate_cell':
            sheet_id = params.get('sheet_id', '')
            cell_ref = params.get('cell_ref', '')
            formula = params.get('formula', '')
            context = params.get('context', {})
            
            result = calculate_cell(formula, context)
            return {'result': result}

        elif method == 'spreadsheet/get_cell':
            # TODO: Implement cell retrieval from stored spreadsheet
            return {'result': {'value': None, 'formula': None, 'format': None}}

        elif method == 'spreadsheet/set_cell':
            # TODO: Implement cell setting and dependency recalculation
            return {'result': {'success': True, 'recalculated_cells': []}}

        elif method == 'spreadsheet/recalculate':
            # TODO: Implement full sheet recalculation
            return {'result': {'success': True, 'cells_updated': []}}

        elif method == 'spreadsheet/get_sheet_data':
            # TODO: Implement sheet data retrieval
            return {'result': {'cells': {}, 'formulas': {}, 'metadata': {}}}

        elif method == 'spreadsheet/get_sheet_data_for_rag':
            """
            Get spreadsheet data formatted for RAG indexing.
            This ensures formulas are visible in context!
            """
            sheet_id = params.get('sheet_id', '')
            workbook_id = params.get('workbook_id', '')
            filename = params.get('filename', '')
            
            # TODO: Load actual spreadsheet data
            # Format: "Cell A1: 100, Cell B1: =A1*2 (calculated: 200)"
            
            text_content = f"Spreadsheet: {filename}\n\n"
            text_content += "Formulas are visible in this context (no hidden equations).\n"
            
            return {
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
            return {'result': {'status': 'healthy', 'mode': 'formula-calculation'}}

        else:
            return {'error': f'Unknown method: {method}'}

    except Exception as e:
        return {'error': str(e)}


if __name__ == '__main__':
    # MCP stdio protocol
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            response = handle_request(request)
            print(json.dumps(response))
            sys.stdout.flush()
        except Exception as e:
            error_response = {'error': str(e)}
            print(json.dumps(error_response))
            sys.stdout.flush()
