## Electron MCP UI Automation (Stable Selectors)

This repo uses **stable `data-testid` selectors** for deterministic UI automation (and future agent/bot control).

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

### Chat selectors

- **Input**: `input[data-testid="chat-input"]`
- **Send**: `button[data-testid="chat-send"]`

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
