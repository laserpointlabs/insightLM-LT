#!/usr/bin/env python3
"""
Jupyter Notebook MCP Server
Provides notebook execution capabilities via MCP protocol
"""
import os
import sys
import json
import asyncio
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
import traceback

# Jupyter imports
try:
    import jupyter_client
    from jupyter_client import KernelManager
    from nbformat import read, write
    from nbformat.v4 import new_notebook, new_code_cell, new_output
    JUPYTER_AVAILABLE = True
except ImportError:
    JUPYTER_AVAILABLE = False
    print("Warning: Jupyter dependencies not available", file=sys.stderr)

# Get data directory from environment
DATA_DIR = os.environ.get("INSIGHTLM_DATA_DIR", "")

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

class JupyterKernelManager:
    """Manages Jupyter kernels for notebook execution"""

    def __init__(self):
        self.kernels: Dict[str, KernelManager] = {}
        self.kernel_clients: Dict[str, Any] = {}

    def start_kernel(self, kernel_name: str = 'python3') -> str:
        """Start a new kernel and return its ID"""
        if not JUPYTER_AVAILABLE:
            raise RuntimeError("Jupyter dependencies not available")

        kernel_id = f"kernel_{len(self.kernels)}"

        # Create kernel manager
        km = KernelManager(kernel_name=kernel_name)
        km.start_kernel()

        # Create client
        kc = km.client()
        kc.start_channels()

        # Wait for kernel to be ready
        kc.wait_for_ready(timeout=10)

        self.kernels[kernel_id] = km
        self.kernel_clients[kernel_id] = kc

        return kernel_id

    def execute_cell(self, kernel_id: str, code: str) -> Dict[str, Any]:
        """Execute code in the specified kernel"""
        if kernel_id not in self.kernel_clients:
            raise ValueError(f"Kernel {kernel_id} not found")

        kc = self.kernel_clients[kernel_id]

        # Execute the code
        msg_id = kc.execute(code)

        # Collect outputs
        outputs = []
        while True:
            try:
                msg = kc.get_iopub_msg(timeout=5)
                msg_type = msg['header']['msg_type']

                if msg_type == 'execute_result':
                    outputs.append({
                        'output_type': 'execute_result',
                        'data': msg['content']['data'],
                        'execution_count': msg['content']['execution_count']
                    })
                elif msg_type == 'stream':
                    outputs.append({
                        'output_type': 'stream',
                        'name': msg['content']['name'],
                        'text': msg['content']['text']
                    })
                elif msg_type == 'display_data':
                    outputs.append({
                        'output_type': 'display_data',
                        'data': msg['content']['data']
                    })
                elif msg_type == 'error':
                    outputs.append({
                        'output_type': 'error',
                        'ename': msg['content']['ename'],
                        'evalue': msg['content']['evalue'],
                        'traceback': msg['content']['traceback']
                    })
                elif msg_type == 'status' and msg['content']['execution_state'] == 'idle':
                    # Execution finished
                    break

            except Exception as e:
                # Timeout or other error
                outputs.append({
                    'output_type': 'error',
                    'ename': 'ExecutionError',
                    'evalue': str(e),
                    'traceback': [str(e)]
                })
                break

        return {'outputs': outputs}

    def shutdown_kernel(self, kernel_id: str):
        """Shutdown a kernel"""
        if kernel_id in self.kernel_clients:
            try:
                self.kernel_clients[kernel_id].stop_channels()
            except:
                pass

        if kernel_id in self.kernels:
            try:
                self.kernels[kernel_id].shutdown_kernel()
            except:
                pass

            del self.kernels[kernel_id]

        if kernel_id in self.kernel_clients:
            del self.kernel_clients[kernel_id]

    def shutdown_all(self):
        """Shutdown all kernels"""
        for kernel_id in list(self.kernels.keys()):
            self.shutdown_kernel(kernel_id)

# Global kernel manager
kernel_manager = JupyterKernelManager()

def handle_execute_cell(request: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a single notebook cell"""
    try:
        params = request.get('params', {})
        code = params.get('code', '')
        kernel_name = params.get('kernel_name', 'python3')

        # Start kernel if needed (for now, use a shared kernel)
        kernel_id = getattr(handle_execute_cell, '_kernel_id', None)
        if kernel_id is None:
            kernel_id = kernel_manager.start_kernel(kernel_name)
            handle_execute_cell._kernel_id = kernel_id

        # Execute the cell
        result = kernel_manager.execute_cell(kernel_id, code)

        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': result
        }

    except Exception as e:
        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'error': {
                'code': -32603,
                'message': f'Execution failed: {str(e)}',
                'data': traceback.format_exc()
            }
        }

def handle_create_notebook(request: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new notebook file"""
    try:
        params = request.get('params', {})
        path = params.get('path', '')
        kernel_name = params.get('kernel_name', 'python3')

        # Create a basic notebook
        nb = new_notebook()
        nb.metadata.kernelspec = {
            'name': kernel_name,
            'display_name': f'Python 3 ({kernel_name})',
            'language': 'python'
        }

        # Add a sample cell
        cell = new_code_cell(
            source='# Welcome to insightLM-LT!\nprint("Hello, World!")',
            metadata={}
        )
        nb.cells.append(cell)

        # Save to file
        full_path = Path(get_data_dir()) / path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        with open(full_path, 'w', encoding='utf-8') as f:
            write(nb, f)

        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': {'message': f'Notebook created at {path}'}
        }

    except Exception as e:
        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'error': {
                'code': -32603,
                'message': f'Failed to create notebook: {str(e)}',
                'data': traceback.format_exc()
            }
        }

def handle_list_kernels(request: Dict[str, Any]) -> Dict[str, Any]:
    """List available kernels"""
    try:
        if not JUPYTER_AVAILABLE:
            return {
                'jsonrpc': '2.0',
                'id': request.get('id'),
                'result': {'kernels': []}
            }

        # Get available kernels
        from jupyter_client.kernelspec import find_kernel_specs
        kernels = list(find_kernel_specs().keys())

        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': {'kernels': kernels}
        }

    except Exception as e:
        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'error': {
                'code': -32603,
                'message': f'Failed to list kernels: {str(e)}'
            }
        }

def handle_request(request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Handle MCP request"""
    method = request.get('method', '')

    if method == 'notebook/execute_cell':
        return handle_execute_cell(request)
    elif method == 'notebook/create':
        return handle_create_notebook(request)
    elif method == 'notebook/list_kernels':
        return handle_list_kernels(request)
    elif method == 'initialize':
        # MCP protocol initialization
        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': {
                'protocolVersion': '2024-11-05',
                'capabilities': {
                    'tools': {
                        'listChanged': True
                    }
                },
                'serverInfo': {
                    'name': 'jupyter-server',
                    'version': '0.1.0'
                }
            }
        }
    elif method == 'tools/list':
        # List available tools
        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': {
                'tools': [
                    {
                        'name': 'execute_cell',
                        'description': 'Execute Python code in a Jupyter kernel',
                        'inputSchema': {
                            'type': 'object',
                            'properties': {
                                'code': {'type': 'string', 'description': 'Python code to execute'},
                                'kernel_name': {'type': 'string', 'description': 'Kernel name (default: python3)'}
                            },
                            'required': ['code']
                        }
                    },
                    {
                        'name': 'create_notebook',
                        'description': 'Create a new Jupyter notebook file',
                        'inputSchema': {
                            'type': 'object',
                            'properties': {
                                'path': {'type': 'string', 'description': 'Relative path for the notebook'},
                                'kernel_name': {'type': 'string', 'description': 'Kernel name (default: python3)'}
                            },
                            'required': ['path']
                        }
                    },
                    {
                        'name': 'list_kernels',
                        'description': 'List available Jupyter kernels',
                        'inputSchema': {
                            'type': 'object',
                            'properties': {}
                        }
                    }
                ]
            }
        }
    elif method == 'tools/call':
        # Handle tool calls
        params = request.get('params', {})
        tool_name = params.get('name')
        tool_args = params.get('arguments', {})

        if tool_name == 'execute_cell':
            # Convert to our internal format
            internal_request = {
                'method': 'notebook/execute_cell',
                'params': tool_args,
                'id': request.get('id')
            }
            return handle_execute_cell(internal_request)
        elif tool_name == 'create_notebook':
            internal_request = {
                'method': 'notebook/create',
                'params': tool_args,
                'id': request.get('id')
            }
            return handle_create_notebook(internal_request)
        elif tool_name == 'list_kernels':
            internal_request = {
                'method': 'notebook/list_kernels',
                'id': request.get('id')
            }
            return handle_list_kernels(internal_request)

    return None

def main():
    """Main MCP server loop"""
    try:
        # Read from stdin, write to stdout (MCP stdio protocol)
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())

                # Handle the request
                response = handle_request(request)

                if response:
                    print(json.dumps(response), flush=True)

            except json.JSONDecodeError as e:
                # Send error response
                error_response = {
                    'jsonrpc': '2.0',
                    'id': None,
                    'error': {
                        'code': -32700,
                        'message': f'Parse error: {str(e)}'
                    }
                }
                print(json.dumps(error_response), flush=True)

            except Exception as e:
                # Send error response
                error_response = {
                    'jsonrpc': '2.0',
                    'id': request.get('id') if 'request' in locals() else None,
                    'error': {
                        'code': -32603,
                        'message': f'Internal error: {str(e)}',
                        'data': traceback.format_exc()
                    }
                }
                print(json.dumps(error_response), flush=True)

    except KeyboardInterrupt:
        pass
    finally:
        # Cleanup
        kernel_manager.shutdown_all()

if __name__ == '__main__':
    main()
