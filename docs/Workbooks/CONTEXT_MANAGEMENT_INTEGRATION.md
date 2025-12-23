# Context Management Integration Plan (CMS-first, MCP-based)

## Problem Statement

The workbook enhancement plan focuses on UI/UX improvements (drag-and-drop, CRUD operations) but doesn't address how the **Context Management System (CMS)** will discover, query, and track workbooks. We need to ensure workbook enhancements expose the necessary **MCP tools** and metadata for context management, without painting ourselves into a corner.

**Architecture Decision (clarified)**:
- **IPC is still required for the UI**: the renderer (React) must call the Electron main process for immediate UX and privileged operations.
- **MCP is the contract for the AI/tooling layer**: the LLM discovers and calls tools via MCP servers.
- **CMS is a first-class core feature**: Chat/RAG/Dashboards/Workbooks all scope to the active CMS context.

So, it is **not** “no more APIs anywhere”. It is: **no more LLM-facing bespoke APIs**—use MCP tools for that layer.

## Context Management Requirements

Based on the vision documents and `context-rag` plan, the context management system needs:

### 1. Workbook Discovery & Querying
- **List all workbooks** (with metadata: id, name, folders, file count)
- **List files in workbook** (with folder paths: `documents/file.ext` or `documents/folder/file.ext`)
- **Query workbook structure** (folders, files, hierarchy)
- **Get workbook metadata** (created, updated, archived status)

### 2. Folder Structure Visibility
- **One-level folders** must be queryable
- **Folder paths** must be included in file metadata
- **Files in folders** must be discoverable with full path

### 3. Change Tracking
- **File added/moved/renamed/deleted** events
- **Folder created/renamed/deleted** events
- **Workbook structure changes** (for incremental indexing)

### 4. Metadata for RAG Indexing
- **File paths** (relative to workbook: `documents/file.ext` or `documents/folder/file.ext`)
- **File types** (for appropriate parsing)
- **Modification times** (for incremental indexing)
- **Folder names** (for namespacing in vector DB)

## Current State Analysis

### ✅ What Exists
- `workbook:getAll()` - Lists workbooks
- `workbook:get(id)` - Gets workbook with documents array
- `file:add/delete/move` - File operations
- `workbook:createFolder/deleteFolder` - Folder operations

### ❌ What's Missing
- **Folder-aware file listing** - Documents array doesn't include folder paths
- **Change events/hooks** - No way to notify context system of changes
- **File metadata MCP tools** - No MCP tools to query file metadata (mtime, type, folder)
- **Folder structure MCP tools** - No MCP tools to query folder hierarchy
- **Context management MCP server** - No MCP server for context operations
- **Context-aware queries** - No way to filter by context

## Required Enhancements

### Phase 0: Decide the “Source of Truth” + Storage Contract (CRITICAL)

To avoid a brittle system, CMS must reference stable objects. That means:
- **Stable identifiers**: workbooks already have `id`; files should also have stable `docId` (UUID) so renames/moves don’t break references.
- **Canonical paths**: every file is addressed by a **canonical relative path** (e.g. `documents/foo.md` or `documents/data/foo.csv`).
- **Shared storage**: Electron services and MCP servers operate on the same on-disk schema under the app data dir.

This “storage contract” is what makes CMS + RAG + UI consistent.

### Phase 1: Metadata & Discovery (Backend + MCP Tools) (CRITICAL - Do Before UI Enhancements)

#### 1.1 Enhance Workbook Metadata
**File:** `electron/services/workbookService.ts`

**Current:** Documents array only has `filename` and `path` (but path doesn't include folder)

**Needed:** 
```typescript
interface DocumentMetadata {
  docId: string; // stable UUID for this file entry (does not change when renamed/moved)
  filename: string;
  path: string; // Full relative path: "documents/file.ext" or "documents/folder/file.ext"
  folder?: string; // Folder name if in folder, undefined if root
  addedAt: string;
  modifiedAt?: string; // For incremental indexing
  fileType?: string; // Extension for type detection
  size?: number; // File size
}
```

**Changes:**
- Assign `docId` on ingest/creation
- Track folder-aware `path` consistently
- Update `docId`-stable metadata on move/rename
- Track `modifiedAt`, `fileType`, `size` (for indexing and UX)

#### 1.2 Folder-Aware File Listing
**File:** `electron/services/fileService.ts`

**Add method:**
```typescript
getFilesInWorkbook(workbookId: string, folderName?: string): DocumentMetadata[]
```

**Returns:** All files in workbook (optionally filtered by folder)

#### 1.3 Enhance Workbook Manager MCP Server (LLM-facing discovery tools)
**File:** `mcp-servers/workbook-manager/server.py` (ENHANCE EXISTING)

**Current:** Placeholder with TODOs

**Add MCP Tools (discovery + structure):**
```python
tools = [
    {
        'name': 'list_workbooks',
        'description': 'List all workbooks with metadata',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'context_id': {'type': 'string', 'description': 'Optional: filter by context'}
            }
        }
    },
    {
        'name': 'get_workbook_structure',
        'description': 'Get full workbook structure including folders and files',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'workbook_id': {'type': 'string', 'description': 'Workbook ID'},
                'include_files': {'type': 'boolean', 'description': 'Include file list'}
            },
            'required': ['workbook_id']
        }
    },
    {
        'name': 'list_files_in_workbook',
        'description': 'List files in a workbook, optionally filtered by folder',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'workbook_id': {'type': 'string'},
                'folder_name': {'type': 'string', 'description': 'Optional: filter by folder'}
            },
            'required': ['workbook_id']
        }
    },
    {
        'name': 'list_files_in_folder',
        'description': 'List files in a specific folder within a workbook (folder_name required)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'workbook_id': {'type': 'string'},
                'folder_name': {'type': 'string', 'description': 'Folder name'}
            },
            'required': ['workbook_id', 'folder_name']
        }
    },
    {
        'name': 'list_folders_in_workbook',
        'description': 'List folders in a workbook',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'workbook_id': {'type': 'string'}
            },
            'required': ['workbook_id']
        }
    },
    {
        'name': 'get_file_metadata',
        'description': 'Get metadata for a specific file',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'workbook_id': {'type': 'string'},
                'file_path': {'type': 'string', 'description': 'Relative path to file'}
            },
            'required': ['workbook_id', 'file_path']
        }
    }
]
```

**Implementation Notes (IMPORTANT CORRECTION):**
- MCP servers are separate processes. **They cannot call Electron services** unless we build an explicit host bridge.
- Today we do not have that bridge. Building it is non-trivial and adds complexity.
- **Recommendation**: MCP servers should operate directly on the **app data directory** (same pattern as `workbook-rag` via `INSIGHTLM_DATA_DIR`) and read/update `workbook.json` + files under `workbooks/<id>/documents/...`.

This keeps the system consistent without inventing a new coupling layer.

### Phase 2: Change Events via MCP Notifications (CRITICAL - Do Before UI Enhancements)

#### 2.1 Event Emitter Pattern
**File:** `electron/services/workbookService.ts`

**Add:**
```typescript
import { EventEmitter } from 'events';

export class WorkbookService extends EventEmitter {
  // Emit events:
  // - 'workbook:created' (workbookId, metadata)
  // - 'workbook:renamed' (workbookId, oldName, newName)
  // - 'workbook:deleted' (workbookId)
  // - 'folder:created' (workbookId, folderName)
  // - 'folder:renamed' (workbookId, oldName, newName)
  // - 'folder:deleted' (workbookId, folderName)
  // - 'file:added' (workbookId, fileMetadata)
  // - 'file:moved' (workbookId, oldPath, newPath, fileMetadata)
  // - 'file:renamed' (workbookId, oldPath, newPath, fileMetadata)
  // - 'file:deleted' (workbookId, path)
}
```

#### 2.2 MCP Notification System
**File:** `mcp-servers/workbook-manager/server.py` (ENHANCE)

**Add MCP Notifications:**
```python
# MCP servers can send notifications (not responses to requests)
# Format: {"jsonrpc": "2.0", "method": "notifications/workbook_changed", "params": {...}}

def send_notification(method: str, params: dict):
    """Send MCP notification to Electron main process"""
    notification = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params
    }
    print(json.dumps(notification), flush=True)
```

**File:** `electron/services/mcpService.ts` (ENHANCE)

**Add notification handling:**
- Listen for notifications from MCP servers
- Forward to subscribed services (context-manager, context-rag)
- Or: WorkbookService emits events → MCPService forwards to MCP servers

**Reality check / recommendation**:
- MCP push notifications are valuable, but they require extra host support (routing, buffering, subscriptions).
- We should treat notifications as **Phase 2b (polish/perf)**.
- **Phase 2 (MVP)**: CMS + RAG correctness using **pull**:
  - Tools query the current state from storage when needed (scoped by active context).
  - Add push notifications later to reduce refresh/polling and improve UX.

### Phase 3: Context Management MCP Server (CRITICAL - Core Feature)

#### 3.1 Create Context Manager MCP Server
**File:** `mcp-servers/context-manager/server.py` (NEW)

**MCP Tools:**
```python
tools = [
    {
        'name': 'create_context',
        'description': 'Create a new context with active workbooks',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'name': {'type': 'string'},
                'workbook_ids': {'type': 'array', 'items': {'type': 'string'}},
                'folders': {'type': 'array', 'items': {'type': 'string'}}
            },
            'required': ['name', 'workbook_ids']
        }
    },
    {
        'name': 'list_contexts',
        'description': 'List all contexts',
        'inputSchema': {'type': 'object', 'properties': {}}
    },
    {
        'name': 'get_context',
        'description': 'Get context by ID',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'context_id': {'type': 'string'}
            },
            'required': ['context_id']
        }
    },
    {
        'name': 'activate_context',
        'description': 'Activate a context (sets scope for RAG/search/chat)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'context_id': {'type': 'string'}
            },
            'required': ['context_id']
        }
    },
    {
        'name': 'get_active_context',
        'description': 'Get currently active context',
        'inputSchema': {'type': 'object', 'properties': {}}
    },
    {
        'name': 'update_context',
        'description': 'Update context (add/remove workbooks, folders)',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'context_id': {'type': 'string'},
                'updates': {'type': 'object'}
            },
            'required': ['context_id', 'updates']
        }
    },
    {
        'name': 'delete_context',
        'description': 'Delete a context',
        'inputSchema': {
            'type': 'object',
            'properties': {
                'context_id': {'type': 'string'}
            },
            'required': ['context_id']
        }
    },
    {
        'name': 'get_context_workbooks',
        'description': 'Get workbooks in active context (for RAG scoping)',
        'inputSchema': {'type': 'object', 'properties': {}}
    }
]
```

**Storage:** JSON files under the app data dir:
- `INSIGHTLM_DATA_DIR/contexts/active.json` (active context pointer)
- `INSIGHTLM_DATA_DIR/contexts/<contextId>.json` (individual contexts)

#### 3.2 Context-Aware Workbook Queries
**Enhance:** `workbook-manager` MCP server tools to accept optional `context_id` filter

**Integration:** `context-rag` MCP server calls `context-manager` to get active context, then filters workbook queries

### Phase 4: UI Enhancements (Can Proceed After Phase 1 & 2)

Once metadata APIs and change events are in place, UI enhancements can proceed:
- Drag-and-drop (will emit change events)
- CRUD operations (will emit change events)
- Folder display (will use folder-aware APIs)

## Implementation Order

### ✅ MUST DO FIRST (Before UI Enhancements)

1. **Phase 0**: Storage contract for CMS
   - Add stable `docId` for files in `workbook.json`
   - Ensure canonical folder-aware paths everywhere

2. **Phase 1.1-1.2**: Metadata & Discovery Backend (UI path)
   - Enhance document metadata to include folder paths + file metadata
   - Add folder-aware listing helpers (used by UI and services)

3. **Phase 1.3**: Workbook Manager MCP Server (LLM discovery path)
   - Enhance `workbook-manager` MCP server with structure query tools
   - Add tools: `get_workbook_structure`, `list_files_in_workbook`, `list_folders_in_workbook`, `get_file_metadata`
   - Implement direct filesystem access against app data dir schema

4. **Phase 2 (MVP)**: CMS correctness via pull
   - `context-manager` defines active context
   - `context-rag` and chat scope to the active context by calling `context-manager`
   - UI can refresh view state from Electron services as it does today

5. **Phase 2b (optional polish)**: Change events via MCP notifications
   - Add EventEmitter to WorkbookService
   - Emit events on CRUD operations
   - Add host routing and MCP notifications to reduce polling/refresh needs

6. **Phase 3**: Context Manager MCP Server
   - Create `context-manager` MCP server
   - Implement context CRUD operations
   - Implement context activation
   - Store contexts in JSON files

### ⚠️ CAN DO IN PARALLEL

7. **Phase 4**: UI Enhancements
   - Drag-and-drop
   - CRUD operations
   - Folder display

## Updated Workbook Enhancement Plan

The original workbook enhancement plan should be updated to:

1. **Ensure all CRUD operations emit events** (Phase 2)
2. **Use folder-aware paths** for file listing (Phase 1)
3. **Include folder paths** in all file operations (Phase 1)
4. **Add metadata tracking** (mtime, file type, size) (Phase 1)
5. **Add stable `docId`** so CMS can reference files robustly (Phase 0)

## Testing Checklist

### Metadata MCP Tools
- [ ] `workbook-manager/get_workbook_structure` returns full hierarchy
- [ ] `workbook-manager/list_files_in_workbook` returns files with folder paths
- [ ] `workbook-manager/list_folders_in_workbook` returns folder list
- [ ] `workbook-manager/get_file_metadata` includes folder information
- [ ] LLM can discover and call these tools

### Change Events (MCP Notifications)
- [ ] File add emits `file:added` event → MCP notification
- [ ] File move emits `file:moved` event → MCP notification
- [ ] File rename emits `file:renamed` event → MCP notification
- [ ] File delete emits `file:deleted` event → MCP notification
- [ ] Folder create emits `folder:created` event → MCP notification
- [ ] Folder rename emits `folder:renamed` event → MCP notification
- [ ] Folder delete emits `folder:deleted` event → MCP notification
- [ ] MCP servers receive notifications (context-manager, context-rag)
- [ ] Events include full metadata

### Context Integration (MCP-Based)
- [ ] `context-manager` MCP server can query workbook structure via `workbook-manager`
- [ ] `context-manager` receives change notifications
- [ ] `context-rag` MCP server queries active context from `context-manager`
- [ ] `context-rag` filters workbook queries by active context
- [ ] RAG indexing can use folder-aware paths from `workbook-manager`
- [ ] LLM can discover and use context management tools

## Success Criteria

- ✅ Context management system can discover all workbooks and files
- ✅ Context management system receives real-time change notifications
- ✅ Folder structure is fully visible to context system
- ✅ RAG indexing can use folder paths for namespacing
- ✅ UI enhancements don't break context system integration
- ✅ No data loss or inconsistency between UI and context system

## Wiring CMS scoping into LLM/RAG (Implementation Notes)

To make context real (not just stored), the application must apply the active context as a default scope for retrieval.

Implemented approach (MVP):
- **LLM core tools** (`list_workbooks`, `search_workbooks`, `list_all_workbook_files`) automatically filter to the active context’s `workbook_ids` (if any).
- **RAG MCP tool calls** (`rag_search_content`, `rag_list_files`) accept optional `workbook_ids` and are invoked with those IDs when an active context exists.

Fallback behavior:
- If `context-manager` is unavailable or no context is active, tools operate across all workbooks (legacy behavior).

## UI: Contexts view + chat commands (MVP)

The user can set/inspect context scoping without needing to “know” MCP:

- **Sidebar → Contexts panel**
  - List contexts
  - Create/edit contexts by selecting workbooks
  - Activate a context (sets the global scope used by LLM/RAG)
  - Delete contexts
- **Chat commands (optional wrapper)**
  - `/context list`
  - `/context active`
  - `/context activate <nameOrId>`

Under the hood, both the Contexts panel and chat commands call the same `context-manager` MCP tools.
