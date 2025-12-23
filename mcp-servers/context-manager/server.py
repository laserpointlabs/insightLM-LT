#!/usr/bin/env python3
"""
Context Manager MCP Server (CMS)

Responsibilities:
- CRUD for "contexts" (named scopes over a set of workbooks and optional folders)
- Track the "active context" (single selection) used to scope Chat/RAG/Dashboards

Storage (under INSIGHTLM_DATA_DIR):
- contexts/
  - active.json                (pointer to active context)
  - <contextId>.json           (context documents)

Notes:
- This server operates directly on the app data directory (no Electron IPC bridge).
- All responses are JSON-RPC compatible.
- Avoid Python 3.10-only typing syntax to maximize compatibility.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4


PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "context-manager"
SERVER_VERSION = "0.1.0"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _repo_root_from_here() -> Path:
    # .../mcp-servers/context-manager/server.py -> parents[2] == repo root
    return Path(__file__).resolve().parents[2]


def get_data_dir() -> Path:
    env_dir = os.environ.get("INSIGHTLM_DATA_DIR")
    if env_dir:
        return Path(env_dir).expanduser().resolve()
    # Dev fallback
    return (_repo_root_from_here() / "data").resolve()


def get_contexts_dir() -> Path:
    return get_data_dir() / "contexts"


def _atomic_write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(path)


def _read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _context_path(context_id: str) -> Path:
    return get_contexts_dir() / f"{context_id}.json"


def _active_path() -> Path:
    return get_contexts_dir() / "active.json"


def _validate_workbook_ids(workbook_ids: Any) -> List[str]:
    if not isinstance(workbook_ids, list) or not all(isinstance(x, str) for x in workbook_ids):
        raise ValueError("workbook_ids must be an array of strings")
    # de-dupe preserving order
    seen = set()
    out: List[str] = []
    for wid in workbook_ids:
        if wid not in seen:
            out.append(wid)
            seen.add(wid)
    return out


def _validate_folders(folders: Any) -> Optional[List[str]]:
    if folders is None:
        return None
    if not isinstance(folders, list) or not all(isinstance(x, str) for x in folders):
        raise ValueError("folders must be an array of strings")
    # One-level folder names only; no slashes
    cleaned: List[str] = []
    seen = set()
    for f in folders:
        f2 = f.strip()
        if not f2:
            continue
        if "/" in f2 or "\\" in f2:
            raise ValueError("folders entries must be one-level names (no slashes)")
        if f2 not in seen:
            cleaned.append(f2)
            seen.add(f2)
    return cleaned


def create_context_impl(name: str, workbook_ids: List[str], folders: Optional[List[str]] = None) -> Dict[str, Any]:
    if not isinstance(name, str) or not name.strip():
        raise ValueError("name is required")

    ctx_id = str(uuid4())
    now = _now_iso()

    ctx = {
        "id": ctx_id,
        "name": name.strip(),
        "workbook_ids": _validate_workbook_ids(workbook_ids),
        "folders": _validate_folders(folders),
        "created": now,
        "updated": now,
    }

    _atomic_write_json(_context_path(ctx_id), ctx)
    return ctx


def list_contexts_impl() -> Dict[str, Any]:
    contexts_dir = get_contexts_dir()
    if not contexts_dir.exists():
        return {"contexts": []}

    results: List[Dict[str, Any]] = []
    for p in sorted(contexts_dir.glob("*.json")):
        if p.name == "active.json":
            continue
        try:
            c = _read_json(p)
            results.append({
                "id": c.get("id") or p.stem,
                "name": c.get("name"),
                "workbook_ids": c.get("workbook_ids") or [],
                "folders": c.get("folders"),
                "created": c.get("created"),
                "updated": c.get("updated"),
            })
        except Exception:
            continue

    return {"contexts": results}


def get_context_impl(context_id: str) -> Dict[str, Any]:
    if not context_id:
        raise ValueError("context_id is required")
    p = _context_path(context_id)
    if not p.exists():
        raise FileNotFoundError(f"Context not found: {context_id}")
    ctx = _read_json(p)
    # normalize minimal fields
    if not ctx.get("id"):
        ctx["id"] = context_id
    return ctx


def update_context_impl(context_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    ctx = get_context_impl(context_id)
    if not isinstance(updates, dict):
        raise ValueError("updates must be an object")

    changed = False

    if "name" in updates:
        name = updates.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("name must be a non-empty string")
        if ctx.get("name") != name.strip():
            ctx["name"] = name.strip()
            changed = True

    if "workbook_ids" in updates:
        wids = _validate_workbook_ids(updates.get("workbook_ids"))
        if ctx.get("workbook_ids") != wids:
            ctx["workbook_ids"] = wids
            changed = True

    if "folders" in updates:
        folders = _validate_folders(updates.get("folders"))
        if ctx.get("folders") != folders:
            ctx["folders"] = folders
            changed = True

    if changed:
        ctx["updated"] = _now_iso()
        _atomic_write_json(_context_path(context_id), ctx)

    return ctx


def delete_context_impl(context_id: str) -> Dict[str, Any]:
    p = _context_path(context_id)
    if not p.exists():
        raise FileNotFoundError(f"Context not found: {context_id}")

    # If active, clear active
    ap = _active_path()
    if ap.exists():
        try:
            active = _read_json(ap)
            if active.get("context_id") == context_id:
                _atomic_write_json(ap, {"context_id": None, "updated": _now_iso()})
        except Exception:
            pass

    p.unlink()
    return {"deleted": True, "context_id": context_id}


def activate_context_impl(context_id: str) -> Dict[str, Any]:
    # Validate it exists
    _ = get_context_impl(context_id)
    ap = _active_path()
    _atomic_write_json(ap, {"context_id": context_id, "activatedAt": _now_iso()})
    return {"active": True, "context_id": context_id}


def get_active_context_impl() -> Dict[str, Any]:
    ap = _active_path()
    if not ap.exists():
        return {"active": None}
    data = _read_json(ap)
    ctx_id = data.get("context_id")
    if not ctx_id:
        return {"active": None}
    ctx = get_context_impl(ctx_id)
    return {"active": ctx, "activatedAt": data.get("activatedAt")}


def get_context_workbooks_impl(context_id: Optional[str] = None) -> Dict[str, Any]:
    if context_id:
        ctx = get_context_impl(context_id)
        return {"context_id": ctx["id"], "workbook_ids": ctx.get("workbook_ids") or [], "folders": ctx.get("folders")}

    active = get_active_context_impl()
    if not active.get("active"):
        return {"context_id": None, "workbook_ids": [], "folders": None}
    ctx = active["active"]
    return {"context_id": ctx["id"], "workbook_ids": ctx.get("workbook_ids") or [], "folders": ctx.get("folders")}


TOOLS: List[Dict[str, Any]] = [
    {
        "name": "create_context",
        "description": "Create a new context with active workbooks (and optional folders).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "workbook_ids": {"type": "array", "items": {"type": "string"}},
                "folders": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["name", "workbook_ids"],
        },
    },
    {
        "name": "list_contexts",
        "description": "List all contexts.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_context",
        "description": "Get a context by ID.",
        "inputSchema": {
            "type": "object",
            "properties": {"context_id": {"type": "string"}},
            "required": ["context_id"],
        },
    },
    {
        "name": "update_context",
        "description": "Update a context (name/workbook_ids/folders).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "context_id": {"type": "string"},
                "updates": {"type": "object"},
            },
            "required": ["context_id", "updates"],
        },
    },
    {
        "name": "delete_context",
        "description": "Delete a context by ID (clears active context if it was active).",
        "inputSchema": {
            "type": "object",
            "properties": {"context_id": {"type": "string"}},
            "required": ["context_id"],
        },
    },
    {
        "name": "activate_context",
        "description": "Set the active context (global scope for chat/RAG/dashboards).",
        "inputSchema": {
            "type": "object",
            "properties": {"context_id": {"type": "string"}},
            "required": ["context_id"],
        },
    },
    {
        "name": "get_active_context",
        "description": "Get the currently active context.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_context_workbooks",
        "description": "Get workbook_ids (+ optional folders) for a context_id, or for the active context if omitted.",
        "inputSchema": {
            "type": "object",
            "properties": {"context_id": {"type": "string"}},
        },
    },
]


def handle_request(request: Dict[str, Any]) -> Dict[str, Any]:
    method = request.get("method", "")
    params = request.get("params", {}) or {}
    request_id = request.get("id")

    try:
        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {"tools": {"listChanged": True}},
                    "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
                },
            }

        if method == "tools/list":
            return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": TOOLS}}

        if method == "tools/call":
            tool_name = params.get("name", "")
            tool_args = params.get("arguments", {}) or {}

            if tool_name == "create_context":
                result = create_context_impl(
                    tool_args.get("name", ""),
                    tool_args.get("workbook_ids", []),
                    tool_args.get("folders"),
                )
            elif tool_name == "list_contexts":
                result = list_contexts_impl()
            elif tool_name == "get_context":
                result = get_context_impl(tool_args.get("context_id", ""))
            elif tool_name == "update_context":
                result = update_context_impl(tool_args.get("context_id", ""), tool_args.get("updates", {}))
            elif tool_name == "delete_context":
                result = delete_context_impl(tool_args.get("context_id", ""))
            elif tool_name == "activate_context":
                result = activate_context_impl(tool_args.get("context_id", ""))
            elif tool_name == "get_active_context":
                result = get_active_context_impl()
            elif tool_name == "get_context_workbooks":
                result = get_context_workbooks_impl(tool_args.get("context_id"))
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {"code": -32601, "message": f"Unknown tool: {tool_name}"},
                }

            return {"jsonrpc": "2.0", "id": request_id, "result": result}

        # Legacy methods (optional/back-compat)
        if method == "context/list":
            return {"jsonrpc": "2.0", "id": request_id, "result": list_contexts_impl()}
        if method == "context/get":
            return {"jsonrpc": "2.0", "id": request_id, "result": get_context_impl(params.get("context_id", ""))}
        if method == "context/activate":
            return {"jsonrpc": "2.0", "id": request_id, "result": activate_context_impl(params.get("context_id", ""))}

        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Unknown method: {method}"}}

    except Exception as e:
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32603, "message": str(e)}}


if __name__ == "__main__":
    # Send initialization message on startup (helps MCPService detect init)
    init_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            "capabilities": {"tools": {"listChanged": True}},
        },
    }
    print(json.dumps(init_response), flush=True)

    for line in sys.stdin:
        try:
            req = json.loads(line.strip())
            resp = handle_request(req)
            if resp:
                print(json.dumps(resp), flush=True)
        except Exception as e:
            # best-effort error response
            try:
                rid = None
                if "req" in locals() and isinstance(req, dict):
                    rid = req.get("id")
                print(json.dumps({"jsonrpc": "2.0", "id": rid, "error": {"code": -32603, "message": str(e)}}), flush=True)
            except Exception:
                # give up silently
                pass







