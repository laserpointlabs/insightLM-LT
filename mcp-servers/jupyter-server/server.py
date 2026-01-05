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
import re
from urllib.parse import urlparse, unquote

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

def _is_within_dir(base_dir: Path, target: Path) -> bool:
    """Return True if target is within base_dir (after resolving)."""
    try:
        target.relative_to(base_dir)
        return True
    except Exception:
        return False

def _resolve_notebook_fs_path(input_path: str) -> Path:
    """
    Resolve an input notebook path to a filesystem path rooted under get_data_dir().

    Supported forms:
      - Relative paths (e.g. "documents/foo.ipynb")
      - Workbook URL paths (e.g. "workbook://<uuid>/documents/foo.ipynb")

    This function is intentionally fail-soft: it returns a clear ValueError for invalid
    paths instead of letting platform-specific path parsing explode (e.g. WinError 123).
    """
    if not isinstance(input_path, str) or not input_path.strip():
        raise ValueError("Path must be a non-empty string")

    raw = input_path.strip()
    data_dir = Path(get_data_dir())

    # Normalize backslashes early so urlparse behaves consistently if the LLM emits them.
    normalized = raw.replace("\\", "/")

    # workbook://<workbookId>/... -> <dataDir>/workbooks/<workbookId>/...
    if normalized.lower().startswith("workbook://"):
        u = urlparse(normalized)
        workbook_id = unquote(u.netloc or "").strip()
        rel_posix = unquote((u.path or "")).lstrip("/")

        # Validate workbook id. In production we typically use UUIDs, but seeded/demo workbooks may
        # use stable slugs (e.g. "uav-trade-study"). Keep this strict enough to avoid surprises,
        # but allow both forms.
        is_uuid = re.fullmatch(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", workbook_id)
        is_slug = re.fullmatch(r"[0-9A-Za-z][0-9A-Za-z_-]{0,63}", workbook_id)
        if not (is_uuid or is_slug):
            raise ValueError(f"Invalid workbook id in path: {workbook_id!r}")
        if not rel_posix:
            raise ValueError("Workbook path must include a file path after the workbook id")

        rel_path = Path("workbooks") / workbook_id / Path(rel_posix)
        full_path = data_dir / rel_path
    else:
        # Disallow absolute paths; all notebook writes must stay under the app data dir.
        candidate = Path(raw)
        if candidate.is_absolute() or re.match(r"^[a-zA-Z]:[\\/]", raw):
            raise ValueError("Absolute paths are not allowed; provide a relative path or workbook:// URL")

        full_path = data_dir / candidate

    # Normalize and ensure no traversal escapes the data dir.
    base_resolved = data_dir.resolve(strict=False)
    target_resolved = full_path.resolve(strict=False)
    if not _is_within_dir(base_resolved, target_resolved):
        raise ValueError("Invalid path; resolved path escapes the data directory")

    return target_resolved

def _try_update_workbook_metadata_for_created_file(full_path: Path) -> None:
    """
    Best-effort: if a notebook is created under:
      <dataDir>/workbooks/<workbookId>/documents/<filename>.ipynb
    then also update:
      <dataDir>/workbooks/<workbookId>/workbook.json
    so the app's Workbooks UI (which reads metadata) will list the new file.
    Fail-soft: never raise from here.
    """
    try:
        data_dir = Path(get_data_dir()).resolve(strict=False)
        fp = full_path.resolve(strict=False)
        if not _is_within_dir(data_dir, fp):
            return

        rel = fp.relative_to(data_dir)
        parts = list(rel.parts)
        if len(parts) < 4:
            return
        if parts[0] != "workbooks":
            return
        workbook_id = parts[1]
        if parts[2] != "documents":
            return

        # Determine metadata file
        wb_dir = data_dir / "workbooks" / workbook_id
        metadata_path = wb_dir / "workbook.json"
        if not metadata_path.exists():
            return

        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            return

        docs = metadata.get("documents")
        if not isinstance(docs, list):
            docs = []
            metadata["documents"] = docs

        rel_doc_path = "/".join(parts[2:])  # documents/<...>
        filename = parts[-1]

        # Upsert by filename (matches create_file_in_workbook behavior)
        existing_idx = -1
        for i, d in enumerate(docs):
            try:
                if isinstance(d, dict) and d.get("filename") == filename:
                    existing_idx = i
                    break
            except Exception:
                continue

        now = __import__("datetime").datetime.utcnow().isoformat() + "Z"
        if existing_idx >= 0:
            try:
                docs[existing_idx]["path"] = docs[existing_idx].get("path") or rel_doc_path
                docs[existing_idx]["addedAt"] = now
            except Exception:
                pass
        else:
            docs.append({"filename": filename, "path": rel_doc_path, "addedAt": now})

        metadata["updated"] = now
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    except Exception:
        return

class JupyterKernelManager:
    """Manages Jupyter kernels for notebook execution"""

    def __init__(self):
        self.kernels: Dict[str, KernelManager] = {}
        self.kernel_clients: Dict[str, Any] = {}

    def start_kernel(self, kernel_name: str = 'python3', cwd: Optional[str] = None) -> str:
        """Start a new kernel and return its ID"""
        if not JUPYTER_AVAILABLE:
            raise RuntimeError("Jupyter dependencies not available")

        kernel_id = f"kernel_{len(self.kernels)}"

        # Create kernel manager
        km = KernelManager(kernel_name=kernel_name)
        # Strict: we must not silently start a kernel in the wrong directory.
        if not (isinstance(cwd, str) and cwd.strip()):
            raise ValueError("Kernel working directory (cwd) is required")
        km.start_kernel(cwd=cwd)

        # Create client
        kc = km.client()
        kc.start_channels()

        # Wait for kernel to be ready
        kc.wait_for_ready(timeout=10)

        self.kernels[kernel_id] = km
        self.kernel_clients[kernel_id] = kc

        return kernel_id

    def set_cwd(self, kernel_id: str, cwd: str) -> None:
        """
        Strict: update the running kernel's working directory.
        This must not fail-soft; otherwise we risk executing in the wrong directory.
        """
        if kernel_id not in self.kernel_clients:
            raise ValueError(f"Kernel {kernel_id} not found")
        if not isinstance(cwd, str) or not cwd.strip():
            raise ValueError("cwd must be a non-empty string")

        # Ensure the directory exists (kernel cannot chdir into a missing folder).
        try:
            Path(cwd).mkdir(parents=True, exist_ok=True)
        except Exception as e:
            raise RuntimeError(f"Failed to prepare cwd directory {cwd!r}: {e}")

        # Escape backslashes for Windows paths inside a raw string literal.
        safe = cwd.replace("\\", "\\\\")
        ok_marker = "__INSIGHTLM_CWD_OK__="
        err_marker = "__INSIGHTLM_CWD_ERR__="
        preamble = (
            "import os\n"
            "import traceback\n"
            "try:\n"
            f"    os.chdir(r\"{safe}\")\n"
            f"    print(\"{ok_marker}\" + os.getcwd())\n"
            "except Exception as e:\n"
            f"    print(\"{err_marker}\" + repr(e))\n"
            "    raise\n"
        )

        kc = self.kernel_clients[kernel_id]
        msg_id = kc.execute(preamble)

        # Drain iopub until idle; capture stdout/stderr + execute_result to confirm cwd.
        # NOTE: Some kernels emit iopub stream messages without parent_header.msg_id.
        # We intentionally DO NOT filter by parent msg_id here; this is a short, isolated preamble.
        observed = ""
        errors = []
        while True:
            msg = kc.get_iopub_msg(timeout=10)
            msg_type = msg.get("header", {}).get("msg_type")
            if msg_type == "stream":
                observed += str(msg.get("content", {}).get("text") or "")
            elif msg_type == "execute_result":
                try:
                    txt = msg.get("content", {}).get("data", {}).get("text/plain", "")
                    observed += str(txt or "")
                except Exception:
                    pass
            elif msg_type == "error":
                try:
                    errors.append(
                        {
                            "ename": msg.get("content", {}).get("ename"),
                            "evalue": msg.get("content", {}).get("evalue"),
                            "traceback": msg.get("content", {}).get("traceback"),
                        }
                    )
                except Exception:
                    errors.append({"error": "unknown"})
            if msg_type == "status" and msg.get("content", {}).get("execution_state") == "idle":
                break

        low = observed.lower()
        if err_marker.lower() in low:
            raise RuntimeError(f"Failed to set kernel cwd to {cwd!r}; observed={observed!r}")
        if errors:
            raise RuntimeError(f"Failed to set kernel cwd to {cwd!r}; errors={errors!r}; observed={observed!r}")

        # Strict verification (case-insensitive on Windows), using the explicit marker.
        if ok_marker.lower() not in low:
            raise RuntimeError(f"Failed to set kernel cwd to {cwd!r}; observed={observed!r}")
        # Pull the first printed path after the marker and normalize.
        try:
            after = observed.split(ok_marker, 1)[1]
            printed = after.strip().splitlines()[0].strip().strip("'").strip('"')
        except Exception:
            printed = ""
        want = os.path.normcase(os.path.normpath(cwd))
        got = os.path.normcase(os.path.normpath(printed)) if printed else ""
        if not got or got != want:
            raise RuntimeError(f"Failed to set kernel cwd to {cwd!r}; observed={observed!r}")

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

def _outputs_to_nbformat(outputs, execution_count=None):
    """Convert execute_cell output dicts to nbformat output objects (fail-soft)."""
    nb_out = []
    for o in outputs or []:
        try:
            ot = o.get("output_type")
            if ot == "stream":
                nb_out.append(new_output("stream", name=o.get("name", "stdout"), text=o.get("text", "")))
            elif ot == "execute_result":
                nb_out.append(new_output("execute_result", data=o.get("data", {}), execution_count=execution_count))
            elif ot == "display_data":
                nb_out.append(new_output("display_data", data=o.get("data", {})))
            elif ot == "error":
                nb_out.append(
                    new_output(
                        "error",
                        ename=o.get("ename", "Error"),
                        evalue=o.get("evalue", ""),
                        traceback=o.get("traceback", []),
                    )
                )
        except Exception:
            continue
    return nb_out

def handle_execute_cell(request: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a single notebook cell"""
    try:
        params = request.get('params', {})
        code = params.get('code', '')
        kernel_name = params.get('kernel_name', 'python3')
        notebook_path = params.get('notebook_path')  # optional: persist execution into a notebook file
        if not isinstance(notebook_path, str) or not notebook_path.strip():
            return {
                'jsonrpc': '2.0',
                'id': request.get('id'),
                'error': {
                    'code': -32602,
                    'message': 'Missing required param: notebook_path (required to set kernel working directory)',
                }
            }

        # Strict: cwd must be the notebook's directory; no fallbacks.
        full_nb_path = _resolve_notebook_fs_path(notebook_path.strip())
        desired_cwd: str = str(full_nb_path.parent)

        # Start kernel if needed (for now, use a shared kernel)
        kernel_id = getattr(handle_execute_cell, '_kernel_id', None)
        if kernel_id is None:
            kernel_id = kernel_manager.start_kernel(kernel_name, cwd=desired_cwd)
            handle_execute_cell._kernel_id = kernel_id
        else:
            # Shared kernel: keep it aligned to the notebook's directory before each execution.
            kernel_manager.set_cwd(kernel_id, desired_cwd)

        # Execute the cell
        result = kernel_manager.execute_cell(kernel_id, code)

        persisted_fs_path = None
        if isinstance(notebook_path, str) and notebook_path.strip():
            try:
                full_nb_path = _resolve_notebook_fs_path(notebook_path.strip())
                full_nb_path.parent.mkdir(parents=True, exist_ok=True)

                if full_nb_path.exists():
                    with open(full_nb_path, "r", encoding="utf-8") as f:
                        nb = read(f, as_version=4)
                else:
                    nb = new_notebook()
                    nb.metadata.kernelspec = {
                        'name': kernel_name,
                        'display_name': f'Python 3 ({kernel_name})',
                        'language': 'python'
                    }

                # Choose an execution count
                exec_count = None
                for o in result.get("outputs", []):
                    if o.get("output_type") == "execute_result" and "execution_count" in o:
                        exec_count = o.get("execution_count")
                        break
                if exec_count is None:
                    last = 0
                    for c in getattr(nb, "cells", []) or []:
                        try:
                            if c.get("cell_type") == "code" and isinstance(c.get("execution_count"), int):
                                last = max(last, c.get("execution_count"))
                        except Exception:
                            continue
                    exec_count = last + 1

                cell = new_code_cell(source=code, metadata={})
                cell.execution_count = exec_count
                cell.outputs = _outputs_to_nbformat(result.get("outputs", []), exec_count)
                nb.cells.append(cell)

                with open(full_nb_path, "w", encoding="utf-8") as f:
                    write(nb, f)

                _try_update_workbook_metadata_for_created_file(full_nb_path)
                persisted_fs_path = str(full_nb_path)
            except Exception:
                # Fail-soft: still return the execution result
                persisted_fs_path = None

        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': {
                **result,
                **({'persisted_notebook_fs_path': persisted_fs_path} if persisted_fs_path else {})
            }
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

        # Save to file (supports workbook://... URLs and relative paths)
        full_path = _resolve_notebook_fs_path(path)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        with open(full_path, 'w', encoding='utf-8') as f:
            write(nb, f)

        # Best-effort: keep workbook metadata in sync so UI lists the created notebook.
        _try_update_workbook_metadata_for_created_file(full_path)

        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'result': {
                'message': f'Notebook created at {path}',
                'fs_path': str(full_path)
            }
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
                                'kernel_name': {'type': 'string', 'description': 'Kernel name (default: python3)'},
                                'notebook_path': {'type': 'string', 'description': 'Notebook path (required). Used to set kernel working directory and to persist executed cells/outputs. Supports relative paths and workbook:// URLs.'}
                            },
                            'required': ['code', 'notebook_path']
                        }
                    },
                    {
                        'name': 'create_notebook',
                        'description': 'Create a new Jupyter notebook file',
                        'inputSchema': {
                            'type': 'object',
                            'properties': {
                                'path': {'type': 'string', 'description': 'Notebook path. Supports relative paths (e.g. "documents/foo.ipynb") and workbook URLs (e.g. "workbook://<workbookId>/documents/foo.ipynb")'},
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
    # Send initialization message on startup
    init_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "2024-11-05",
            "serverInfo": {
                "name": "jupyter-server",
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
