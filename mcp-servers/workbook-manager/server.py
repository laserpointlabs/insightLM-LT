#!/usr/bin/env python3
"""
Workbook Manager MCP Server
Provides workbook discovery + structure tools for CMS/LLM.

Design:
- Operates directly on the app data directory (same pattern as workbook-rag).
- Reads and (optionally) normalizes `workbook.json` to ensure stable `docId` and canonical paths.
"""
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any
from uuid import uuid4
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_posix(p: str) -> str:
    return p.replace("\\", "/").lstrip("./")


def _repo_root_from_here() -> Path:
    # .../mcp-servers/workbook-manager/server.py -> parents[2] == repo root
    return Path(__file__).resolve().parents[2]


def get_data_dir() -> Path:
    env_dir = os.environ.get("INSIGHTLM_DATA_DIR")
    if env_dir:
        return Path(env_dir).expanduser().resolve()
    # Fallback for dev environments where env injection is missing
    return (_repo_root_from_here() / "data").resolve()


def get_workbooks_dir() -> Path:
    return get_data_dir() / "workbooks"


def read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def ensure_lists(metadata: Dict[str, Any]) -> bool:
    changed = False
    if "folders" not in metadata or not isinstance(metadata.get("folders"), list):
        metadata["folders"] = []
        changed = True
    if "documents" not in metadata or not isinstance(metadata.get("documents"), list):
        metadata["documents"] = []
        changed = True
    return changed


def normalize_workbook_metadata(workbook_id: str, workbook_path: Path, metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Best-effort normalization to ensure:
    - documents[] entries have docId + canonical posix path under documents/
    - derived fields: folder, fileType, size, modifiedAt
    Persists if changes are made.
    """
    changed = ensure_lists(metadata)

    docs_dir = workbook_path / "documents"

    for doc in metadata.get("documents", []):
        if not isinstance(doc, dict):
            continue

        # docId
        if not doc.get("docId"):
            doc["docId"] = str(uuid4())
            changed = True

        # filename/path
        if not doc.get("filename") and isinstance(doc.get("path"), str):
            doc["filename"] = Path(_to_posix(doc["path"])).name
            changed = True

        if not doc.get("path") and doc.get("filename"):
            doc["path"] = f"documents/{doc['filename']}"
            changed = True

        if isinstance(doc.get("path"), str):
            original = doc["path"]
            doc["path"] = _to_posix(doc["path"])
            if doc["path"] != original:
                changed = True

            if not doc["path"].startswith("documents/"):
                doc["path"] = f"documents/{doc.get('filename') or Path(doc['path']).name}"
                changed = True

        if not doc.get("addedAt"):
            doc["addedAt"] = _now_iso()
            changed = True

        # derived folder
        folder = None
        p = doc.get("path")
        if isinstance(p, str):
            parts = [x for x in p.split("/") if x]
            if len(parts) >= 3 and parts[0] == "documents":
                folder = parts[1]
        if doc.get("folder") != folder:
            doc["folder"] = folder
            changed = True

        # derived fileType
        ft = ""
        if doc.get("filename"):
            ft = Path(doc["filename"]).suffix.lower().lstrip(".")
        if doc.get("fileType") != ft:
            doc["fileType"] = ft
            changed = True

        # stats
        try:
            rel = doc.get("path")
            if isinstance(rel, str):
                abs_path = workbook_path / Path(rel)
                if abs_path.exists() and abs_path.is_file():
                    st = abs_path.stat()
                    m = datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
                    if doc.get("modifiedAt") != m:
                        doc["modifiedAt"] = m
                        changed = True
                    if doc.get("size") != st.st_size:
                        doc["size"] = st.st_size
                        changed = True
        except Exception:
            pass

    if changed:
        metadata["updated"] = _now_iso()
        write_json(workbook_path / "workbook.json", metadata)

    return metadata


def load_workbook(workbook_id: str) -> Dict[str, Any]:
    wb_path = get_workbooks_dir() / workbook_id
    meta_path = wb_path / "workbook.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"Workbook not found: {workbook_id}")
    meta = read_json(meta_path)
    return normalize_workbook_metadata(workbook_id, wb_path, meta)


def list_workbooks_impl(context_id: str | None = None) -> Dict[str, Any]:
    # context_id is accepted for future use; filtering happens in context-manager.
    workbooks_dir = get_workbooks_dir()
    if not workbooks_dir.exists():
        return {"workbooks": []}

    results = []
    for entry in sorted(workbooks_dir.iterdir()):
        if not entry.is_dir():
            continue
        meta_path = entry / "workbook.json"
        if not meta_path.exists():
            continue
        try:
            meta = read_json(meta_path)
            meta = normalize_workbook_metadata(entry.name, entry, meta)
            results.append({
                "id": meta.get("id") or entry.name,
                "name": meta.get("name") or entry.name,
                "created": meta.get("created"),
                "updated": meta.get("updated"),
                "archived": bool(meta.get("archived", False)),
                "folders": meta.get("folders", []),
                "fileCount": len(meta.get("documents", []) or []),
            })
        except Exception:
            # Skip malformed entries
            continue

    return {"workbooks": results}


def list_folders_in_workbook_impl(workbook_id: str) -> Dict[str, Any]:
    meta = load_workbook(workbook_id)
    # Union metadata + actual directories under documents/
    wb_path = get_workbooks_dir() / workbook_id
    docs_dir = wb_path / "documents"
    disk_folders = []
    if docs_dir.exists():
        for e in docs_dir.iterdir():
            if e.is_dir():
                disk_folders.append(e.name)
    folders = sorted(set((meta.get("folders") or []) + disk_folders))
    return {"workbookId": workbook_id, "folders": folders}


def _filter_docs(meta: Dict[str, Any], folder_name: str | None) -> list[Dict[str, Any]]:
    docs = meta.get("documents") or []
    if not folder_name:
        return docs
    return [d for d in docs if isinstance(d, dict) and d.get("folder") == folder_name]


def list_files_in_workbook_impl(workbook_id: str, folder_name: str | None = None) -> Dict[str, Any]:
    meta = load_workbook(workbook_id)
    docs = _filter_docs(meta, folder_name)
    return {"workbookId": workbook_id, "folderName": folder_name, "files": docs}


def list_files_in_folder_impl(workbook_id: str, folder_name: str) -> Dict[str, Any]:
    if not folder_name or not folder_name.strip():
        raise ValueError("folder_name is required")
    return list_files_in_workbook_impl(workbook_id, folder_name.strip())


def get_file_metadata_impl(workbook_id: str, file_path: str) -> Dict[str, Any]:
    meta = load_workbook(workbook_id)
    fp = _to_posix(file_path)
    # Canonicalize under documents/
    if not fp.startswith("documents/"):
        fp = f"documents/{fp.lstrip('/')}"
    for d in meta.get("documents") or []:
        if isinstance(d, dict) and _to_posix(str(d.get("path", ""))) == fp:
            return {"workbookId": workbook_id, "file": d}
    raise FileNotFoundError(f"File not found in metadata: {fp}")


def get_workbook_structure_impl(workbook_id: str, include_files: bool = True) -> Dict[str, Any]:
    meta = load_workbook(workbook_id)
    folders = list_folders_in_workbook_impl(workbook_id)["folders"]

    structure: Dict[str, Any] = {
        "workbook": {
            "id": meta.get("id") or workbook_id,
            "name": meta.get("name"),
            "created": meta.get("created"),
            "updated": meta.get("updated"),
            "archived": bool(meta.get("archived", False)),
        },
        "folders": folders,
    }

    if include_files:
        docs = meta.get("documents") or []
        root_files = [d for d in docs if isinstance(d, dict) and not d.get("folder")]
        by_folder: Dict[str, Any] = {}
        for f in folders:
            by_folder[f] = [d for d in docs if isinstance(d, dict) and d.get("folder") == f]
        structure["files"] = {
            "root": root_files,
            "byFolder": by_folder,
        }

    return structure

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
                        'name': 'workbook-manager',
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
                            'name': 'create_workbook',
                            'description': 'Create a new workbook',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'name': {'type': 'string', 'description': 'Workbook name'}
                                },
                                'required': ['name']
                            }
                        },
                        {
                            'name': 'list_workbooks',
                            'description': 'List all workbooks with metadata',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'context_id': {'type': 'string', 'description': 'Optional: filter by context (future)'}
                                }
                            }
                        },
                        {
                            'name': 'get_workbook_structure',
                            'description': 'Get workbook structure including folders and files',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'workbook_id': {'type': 'string', 'description': 'Workbook ID'},
                                    'include_files': {'type': 'boolean', 'description': 'Include file list', 'default': True}
                                },
                                'required': ['workbook_id']
                            }
                        },
                        {
                            'name': 'list_folders_in_workbook',
                            'description': 'List folders inside a workbook (one level)',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'workbook_id': {'type': 'string', 'description': 'Workbook ID'}
                                },
                                'required': ['workbook_id']
                            }
                        },
                        {
                            'name': 'list_files_in_workbook',
                            'description': 'List files in a workbook; optionally filter by folder_name',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'workbook_id': {'type': 'string', 'description': 'Workbook ID'},
                                    'folder_name': {'type': 'string', 'description': 'Optional: folder name'}
                                },
                                'required': ['workbook_id']
                            }
                        },
                        {
                            'name': 'list_files_in_folder',
                            'description': 'List files in a specific folder within a workbook (alias of list_files_in_workbook with required folder_name)',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'workbook_id': {'type': 'string', 'description': 'Workbook ID'},
                                    'folder_name': {'type': 'string', 'description': 'Folder name (required)'}
                                },
                                'required': ['workbook_id', 'folder_name']
                            }
                        },
                        {
                            'name': 'get_file_metadata',
                            'description': 'Get metadata for a workbook file by canonical relative path (documents/... )',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'workbook_id': {'type': 'string', 'description': 'Workbook ID'},
                                    'file_path': {'type': 'string', 'description': 'Relative path to file (documents/...)'}
                                },
                                'required': ['workbook_id', 'file_path']
                            }
                        }
                    ]
                }
            }
        
        elif method == 'tools/call':
            # Handle tool calls
            tool_name = params.get('name', '')
            tool_args = params.get('arguments', {})
            
            if tool_name == 'create_workbook':
                name = tool_args.get('name', '')
                # Guardrail: the LLM sometimes confuses "workbook" with "file" and tries to
                # create a workbook named like a path or notebook filename. Prevent that.
                if isinstance(name, str):
                    n = name.strip()
                    if n.lower().endswith(".ipynb") or "workbook://" in n.lower() or "/" in n or "\\" in n:
                        raise ValueError(
                            'Invalid workbook name. This looks like a file path or notebook filename. '
                            'Use create_notebook (workbook://<id>/documents/<name>.ipynb) or create_file_in_workbook instead.'
                        )
                # Minimal implementation: create workbook directory + workbook.json
                workbooks_dir = get_workbooks_dir()
                workbooks_dir.mkdir(parents=True, exist_ok=True)
                workbook_id = str(uuid4())
                wb_path = workbooks_dir / workbook_id
                (wb_path / "documents").mkdir(parents=True, exist_ok=True)
                now = _now_iso()
                metadata = {
                    "id": workbook_id,
                    "name": name,
                    "created": now,
                    "updated": now,
                    "archived": False,
                    "folders": [],
                    "documents": [],
                }
                write_json(wb_path / "workbook.json", metadata)
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {'message': f'Workbook "{name}" created', 'id': workbook_id}
                }
            
            elif tool_name == 'list_workbooks':
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': list_workbooks_impl(tool_args.get("context_id"))
                }

            elif tool_name == 'get_workbook_structure':
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': get_workbook_structure_impl(
                        tool_args.get("workbook_id", ""),
                        bool(tool_args.get("include_files", True)),
                    )
                }

            elif tool_name == 'list_folders_in_workbook':
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': list_folders_in_workbook_impl(tool_args.get("workbook_id", ""))
                }

            elif tool_name == 'list_files_in_workbook':
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': list_files_in_workbook_impl(
                        tool_args.get("workbook_id", ""),
                        tool_args.get("folder_name"),
                    )
                }

            elif tool_name == 'list_files_in_folder':
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': list_files_in_folder_impl(
                        tool_args.get("workbook_id", ""),
                        tool_args.get("folder_name", ""),
                    )
                }

            elif tool_name == 'get_file_metadata':
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': get_file_metadata_impl(
                        tool_args.get("workbook_id", ""),
                        tool_args.get("file_path", ""),
                    )
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
        elif method == 'workbook/create':
            name = params.get('name', '')
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {'message': f'Workbook "{name}" created', 'id': 'placeholder-id'}
            }
        
        elif method == 'workbook/list':
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': list_workbooks_impl(None)
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
                "name": "workbook-manager",
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
    
    # Read from stdin, write to stdout (MCP stdio protocol)
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
