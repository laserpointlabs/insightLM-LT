## Electron MCP UI Automation (Stable Selectors)

This repo uses **stable `data-testid` selectors** for deterministic UI automation (and future agent/bot control).

### Activity Bar (workbench navigation)

When the app is not in the “Insight Workbench / File” workbench, the stacked sidebar sections (Dashboards/Contexts/Workbooks/Chat) may not be present.

- **File / Insight Workbench**: `button[data-testid="activitybar-item-file"]`
- **Data Workbench**: `button[data-testid="activitybar-item-data"]`
- **Analysis Workbench**: `button[data-testid="activitybar-item-analysis"]`
- **Event Workbench**: `button[data-testid="activitybar-item-event"]`

### Sidebar section headers (collapse/expand)

- **Dashboards header**: `button[data-testid="sidebar-dashboards-header"]`
- **Contexts header**: `button[data-testid="sidebar-contexts-header"]`
- **Workbooks header**: `button[data-testid="sidebar-workbooks-header"]`
- **Chat header**: `button[data-testid="sidebar-chat-header"]`

### Sidebar scope / scoping indicators (always visible)

These show the current Context scoping mode in a way that is visible even when the Contexts panel is collapsed.

- **Main header scoping button (ALL/SCOPED)**: `button[data-testid="sidebar-scope-indicator"]`
- **Main header scope text ("Scope: All workbooks" / "Scope: <context>")**: `[data-testid="sidebar-scope-text"]`
- **Contexts header scoping button (ALL/SCOPED)**: `button[data-testid="contexts-scope-toggle"]`

### Contexts panel selectors

- **Create context button**: `button[data-testid="contexts-create"]`
- **Refresh contexts button**: `button[data-testid="contexts-refresh"]`

Per-row (context id is the MCP context `id`):
- **Row container**: `[data-testid="contexts-item-<contextId>"]`
- **Edit**: `button[data-testid="contexts-edit-<contextId>"]`
- **Activate**: `button[data-testid="contexts-activate-<contextId>"]` (not present if already active)
- **Delete**: `button[data-testid="contexts-delete-<contextId>"]`

Modal:
- **Name input**: `input[data-testid="contexts-modal-name"]`
- **Workbook checkbox**: `input[data-testid="contexts-modal-workbook-checkbox"][data-workbook-id="<workbookId>"]`
- **Save**: `button[data-testid="contexts-modal-save"]`
- **Cancel**: `button[data-testid="contexts-modal-cancel"]`

### Toast selectors

- **Toast container**: `[data-testid="toast-center"]`
- **Toast message**: `[data-testid="toast-message"]`
- **Toast by kind**: `[data-testid="toast-success"]`, `[data-testid="toast-info"]`, `[data-testid="toast-error"]`

### Chat selectors

- **Input**: `input[data-testid="chat-input"]`
- **Send**: `button[data-testid="chat-send"]`
- **New chat**: `button[data-testid="chat-new"]`
- **History**: `button[data-testid="chat-history"]` (placeholder)
- **Settings**: `button[data-testid="chat-settings"]` (placeholder)

### Workbooks selectors (high value)

Header action buttons:
- **Create workbook**: `button[data-testid="workbooks-create"]`
- **Refresh workbooks**: `button[data-testid="workbooks-refresh"]`
- **Collapse all**: `button[data-testid="workbooks-collapse-all"]`

Rows / controls (IDs are dynamic):
- **Workbook row**: `[data-testid="workbooks-item-<workbookId>"]`
- **Workbook expand toggle**: `span[data-testid="workbooks-toggle-<workbookId>"]`
- **Create markdown (workbook)**: `button[data-testid="workbooks-create-markdown-<workbookId>"]`
- **Import files (workbook)**: `button[data-testid="workbooks-create-document-<workbookId>"]`
- **Create folder (workbook)**: `button[data-testid="workbooks-create-folder-<workbookId>"]`

Folder / doc rows use URL-encoding for folder names and document paths:
- **Folder row**: `[data-testid="workbooks-folder-<workbookId>-<encodeURIComponent(folderName)>"]`
- **Doc row**: `[data-testid="workbooks-doc-<workbookId>-<encodeURIComponent(docPath)>"]`
- **Doc rename**: `button[data-testid="workbooks-doc-rename-<workbookId>-<encodeURIComponent(docPath)>"]`
- **Doc move**: `button[data-testid="workbooks-doc-move-<workbookId>-<encodeURIComponent(docPath)>"]`
- **Doc delete**: `button[data-testid="workbooks-doc-delete-<workbookId>-<encodeURIComponent(docPath)>"]`

Dialogs:
- **Input dialog**: `input[data-testid="input-dialog-input"]`, `button[data-testid="input-dialog-ok"]`
- **Move document**: `select[data-testid="move-doc-folder-select"]`, `button[data-testid="move-doc-ok"]`

### Recommended automation rule

Prefer **`click_by_selector`** and **`fill_input`** against `data-testid` selectors over text clicks.
Text clicks are acceptable only for top-level navigation headers (until they also get test ids).

### Automation mode (force-show hover-only controls)

Some UI controls are intentionally **hover-only** for a cleaner UX. For deterministic automation, enable automation mode:

- `window.__insightlmAutomationUI.setMode(true)`

This forces hover-only action buttons (like workbook/folder action icons) to be visible and clickable via selectors.

### Automation helper state (for resolving IDs deterministically)

The Contexts view writes a small read-only snapshot to:

- `window.__insightlmAutomation.contexts`

This lets automation map a context **name → id** synchronously (without async eval), and then use the **id-based selectors**.

### UI smoke test (CDP)

There is a selector-only, end-to-end UI smoke test driven by Chrome DevTools Protocol:

- **Run**: `npm run test:automation:smoke`
- **Precondition**: app running with CDP enabled on `127.0.0.1:9222` (already set in `electron/main.ts`)

For a fully automated end-to-end run that builds, launches a production renderer, runs the CDP smoke,
and cleans up test artifacts (using the isolated smoke workspace):

- **Run**: `npm run smoke:run`

The smoke covers:
- Toggle scoping **All ↔ Scoped**
- Create workbook → create markdown → rename → create folder → move doc into folder
- Send chat message

### How smoke testing works (and how to extend it safely)

For a deeper guide on how we build deterministic, automation-centric smoke coverage (including `npm run smoke:run` / the legacy `npm run test:automation:prod` runner and anti-flake patterns), see:

- `docs/Automation/AUTOMATION_SMOKE_TESTING.md`
