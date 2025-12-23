# Workbook Enhancement Plan

## Overview
Transform the workbook view into a professional-grade file management interface with comprehensive drag-and-drop and CRUD operations.

## CMS / Context Management Compatibility (Must Not Break)

Workbooks enhancements must remain compatible with the **Context Management System (CMS)**. Even before CMS is fully implemented, we must avoid designs that make later CMS integration painful.

**Non-negotiables for CMS compatibility:**
- **Stable file identity**: each file entry should have a stable `docId` (UUID) in `workbook.json` so rename/move doesn’t break references.
- **Canonical folder-aware paths**: treat file paths as canonical relative paths (e.g. `documents/foo.md` or `documents/data/foo.csv`) everywhere.
- **One-level folders only**: folders are namespaces inside a workbook, not nested workbooks.
- **Operations must preserve metadata**: move/rename must update path/name but keep `docId` stable.

## Current State Analysis

### ✅ What's Working
- Basic drag-and-drop files from OS into workbooks
- Workbook CRUD: Create, Rename, Delete
- Folder CRUD: Create, Delete
- File CRUD: Add, Delete
- Context menus for workbooks and files
- Folder structure (one level deep)

### ❌ What's Missing
- **Drag-and-Drop:**
  - Files between workbooks
  - Files into folders
  - Files between folders
  - Files within same folder (reordering)
  - Visual drag feedback and drop zones
- **CRUD Operations:**
  - Rename files (backend exists, UI missing)
  - Rename folders (backend missing)
  - Move files to folders (via context menu)
  - Reorder files/folders
- **UI/UX:**
  - Folder display in tree view
  - Context menus for folders
  - Visual indicators during drag operations
  - Drop zone highlighting

## Implementation Plan

### Phase 0: Stabilize Storage Contract (Required for CMS + future Context-RAG)

**Goal:** Make workbook/folder/file operations safe for future CMS scoping and RAG indexing.

- Add `docId` to each `documents[]` entry in `workbook.json`
- Ensure every document has a canonical `path` including folders when applicable
- Track basic file metadata (`modifiedAt`, `size`, `fileType`) to support incremental indexing and rich UI

This phase is intentionally small but prevents a lot of rework later.

### Phase 1: Backend Enhancements

#### 1.1 Folder Rename Support
**File:** `electron/services/workbookService.ts`
- Add `renameFolder(workbookId: string, oldFolderName: string, newFolderName: string)` method
- Update folder directory name
- Update metadata

#### 1.2 File Move to Folder Support
**File:** `electron/services/fileService.ts`
- Enhance `moveDocument` to support folder paths
- Add `moveDocumentToFolder(workbookId: string, relativePath: string, folderName: string)` method
- Handle moving files between folders
- Ensure move/rename preserves `docId` and updates canonical `path`

#### 1.3 IPC Handlers
**File:** `electron/ipc/workbooks.ts`
- Add `workbook:renameFolder` handler
- Add `file:moveToFolder` handler (or enhance existing `file:move`)

**File:** `electron/preload.ts` & `src/types/electron.d.ts`
- Expose new APIs

### Phase 2: Drag-and-Drop System

#### 2.1 Drag State Management
**File:** `src/components/Sidebar/WorkbooksView.tsx`
- Add drag state tracking:
  - `draggedItem`: { type: 'file' | 'folder', workbookId, path, name }
  - `dragOverTarget`: { type: 'workbook' | 'folder', workbookId, folderName? }
- Visual feedback during drag

#### 2.2 Drop Zones
- Workbook drop zones (accept files from other workbooks)
- Folder drop zones (accept files)
- Visual highlighting on drag over

#### 2.3 Drag Handlers
- `handleDragStart`: Set dragged item data
- `handleDragOver`: Update drag over target, prevent default
- `handleDrop`: Process drop operation
- `handleDragEnd`: Cleanup drag state

#### 2.4 Drop Operations
- **File → Workbook:** Move file to workbook root
- **File → Folder:** Move file to folder
- **File → File (reorder):** Update document order in metadata
- **Cross-workbook moves:** Use existing `file:move` IPC

**CMS note:** if/when we add stable `docId`, reordering should operate on `docId` ordering rather than filename/path, to remain robust across renames/moves.

### Phase 3: CRUD UI Enhancements

#### 3.1 File Context Menu
**Enhance:** `documentContextMenu` in `WorkbooksView.tsx`
- Add "Rename" option
- Add "Move to Folder..." option (with folder picker)
- Add "Move to Workbook..." option (with workbook picker)

#### 3.2 Folder Context Menu
**New:** Folder context menu
- "Rename Folder"
- "Delete Folder"
- "Create File in Folder"
- "Create Folder" (note: **one level only**; no nested folders)

#### 3.3 Rename Dialogs
- File rename dialog (reuse `InputDialog`)
- Folder rename dialog
- Validation (no duplicates, valid names)

### Phase 4: UI/UX Improvements

#### 4.1 Folder Display
- Show folders in tree view with folder icon
- Expandable/collapsible folders
- Files grouped under folders
- Visual distinction between folders and files

#### 4.2 Visual Drag Feedback
- Drag preview/ghost element
- Drop zone highlighting
- "Drop here" indicators
- Disable invalid drop targets

#### 4.3 Keyboard Shortcuts
- F2: Rename selected item
- Delete: Delete selected item
- Ctrl+D: Duplicate (stretch goal)
- Arrow keys: Navigate tree

#### 4.4 Accessibility
- ARIA labels for drag-and-drop
- Keyboard navigation support
- Screen reader announcements

## Technical Implementation Details

### Drag-and-Drop Data Transfer
```typescript
interface DragData {
  type: 'file' | 'folder';
  workbookId: string;
  path: string; // relative path
  name: string;
  folderName?: string; // if in a folder
}
```

### Drop Target Types
```typescript
type DropTarget = 
  | { type: 'workbook', workbookId: string }
  | { type: 'folder', workbookId: string, folderName: string }
  | { type: 'file', workbookId: string, path: string }; // for reordering
```

### File Path Structure
- Root files: `documents/filename.ext`
- Folder files: `documents/folderName/filename.ext`

### Stable Identity (Recommended)

Add a stable file identifier so CMS/context scoping and indexing can reference “the file” even after rename/move:

```typescript
interface DocumentMetadata {
  docId: string; // stable UUID
  filename: string;
  path: string; // canonical relative path under workbook
  folder?: string;
  addedAt: string;
  modifiedAt?: string;
  fileType?: string;
  size?: number;
}
```

### Metadata Updates
- When moving files, update `workbook.json` documents array
- Maintain document order for reordering
- Update `updated` timestamp

## File Structure Changes

### New Files
- `src/components/Sidebar/DragDropContext.tsx` - Drag-and-drop context provider
- `src/components/Sidebar/FolderItem.tsx` - Folder component with drag-drop
- `src/components/Sidebar/FileItem.tsx` - File component with drag-drop
- `src/hooks/useDragAndDrop.ts` - Custom hook for drag-and-drop logic

### Modified Files
- `src/components/Sidebar/WorkbooksView.tsx` - Major refactor
- `electron/services/workbookService.ts` - Add renameFolder
- `electron/services/fileService.ts` - Enhance move operations
- `electron/ipc/workbooks.ts` - Add new handlers
- `electron/ipc/files.ts` - Enhance move handler
- `electron/preload.ts` - Expose new APIs
- `src/types/electron.d.ts` - Type definitions

## Testing Checklist

### Drag-and-Drop
- [ ] Drag file from OS into workbook
- [ ] Drag file from OS into folder
- [ ] Drag file between workbooks
- [ ] Drag file into folder
- [ ] Drag file between folders
- [ ] Drag file to reorder (same folder)
- [ ] Visual feedback during drag
- [ ] Invalid drop targets disabled
- [ ] Error handling for failed moves

### CRUD Operations
- [ ] Rename workbook
- [ ] Rename folder
- [ ] Rename file
- [ ] Delete workbook (with confirmation)
- [ ] Delete folder (with confirmation)
- [ ] Delete file (with confirmation)
- [ ] Create folder
- [ ] Create file in folder
- [ ] Move file to folder (context menu)
- [ ] Move file to workbook (context menu)

### UI/UX
- [ ] Folder tree display
- [ ] Expand/collapse folders
- [ ] Context menus work correctly
- [ ] Keyboard shortcuts
- [ ] Visual drag feedback
- [ ] Drop zone highlighting
- [ ] Error messages clear
- [ ] Loading states during operations

## Implementation Order

1. **Stabilize Storage** (Phase 0)
   - Add stable `docId` and canonical folder-aware paths
   - Add basic file metadata

2. **Backend First** (Phase 1)
   - Add renameFolder to workbookService
   - Enhance file move operations
   - Add IPC handlers
   - Update type definitions

3. **Basic Drag-and-Drop** (Phase 2.1-2.3)
   - Implement drag state management
   - Add drag handlers
   - Basic drop operations

4. **CRUD UI** (Phase 3)
   - Add rename dialogs
   - Enhance context menus
   - Folder context menu

5. **Polish** (Phase 4)
   - Visual feedback
   - Keyboard shortcuts
   - Accessibility

## Success Criteria

- Users can drag-and-drop files anywhere (workbooks, folders)
- All CRUD operations work via context menus
- Visual feedback is clear and professional
- No data loss during operations
- Error handling is robust
- UI feels responsive and polished
