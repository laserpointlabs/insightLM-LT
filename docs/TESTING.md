# Testing Guide for insightLM-LT

## Quick Start Testing

### 1. Install Dependencies

```bash
cd insightLM-LT
npm install
```

### 2. Set Up LLM Configuration (Optional for Basic Testing)

If you want to test the chat feature, set up your LLM provider:

**Option A: OpenAI**

```bash
# Set environment variable
set REDACTED  # Windows
# or
export REDACTED  # Linux/Mac
```

Then edit `config/llm.yaml`:

```yaml
provider: "openai"
apiKey: "${OPENAI_API_KEY}"
model: "gpt-4"
```

**Option B: Ollama (Local, No API Key Needed)**
Edit `config/llm.yaml`:

```yaml
provider: "ollama"
model: "llama3.1"
baseUrl: "http://localhost:11434"
```

Make sure Ollama is running locally if using this option.

**Option C: Skip LLM (Test Without Chat)**
You can test all other features without LLM. Chat will show errors, but everything else works.

### 3. Run the Application

```bash
npm run dev
```

This will:

- Compile TypeScript for Electron
- Start Vite dev server for React
- Launch Electron window

You should see:

- A window with a sidebar (left) and main area (right)
- Sidebar shows "Workbooks" section
- Chat section at bottom of sidebar
- Main area shows "Click a document to view it"

## Testing Workflows

### Test 1: Create a Workbook

1. Click the "+ New" button in the Workbooks section
2. Enter a workbook name (e.g., "Test Workbook")
3. Click OK
4. **Expected**: New workbook appears in the sidebar

### Test 2: Add a Document

**Method A: File Dialog**

1. Expand the workbook by clicking it
2. Click "+ Add File" button
3. Select a file (try a .txt, .md, or .csv file)
4. **Expected**: File appears under the workbook

**Method B: Drag and Drop**

1. Open Windows Explorer
2. Drag a file onto the workbook in the sidebar
3. **Expected**: File is added to the workbook

### Test 3: View a Document

1. Click on a document filename in the workbook tree
2. **Expected**:
   - Document opens in a new tab in the main area
   - Content is displayed based on file type:
     - `.md` files → Rendered markdown
     - `.csv` files → Table view
     - `.txt` files → Monaco editor with syntax highlighting

### Test 4: Rename Workbook

1. Right-click on a workbook
2. Select "Rename"
3. Enter new name
4. **Expected**: Workbook name updates in sidebar

### Test 5: Archive Workbook

1. Right-click on a workbook
2. Select "Archive"
3. **Expected**:
   - Workbook moves to "Archived" section at bottom
   - Workbook is marked as archived

### Test 6: Delete Workbook

1. Right-click on a workbook
2. Select "Delete"
3. Confirm deletion
4. **Expected**: Workbook is removed from sidebar

### Test 7: Chat (If LLM Configured)

1. Type a message in the chat input at bottom of sidebar
2. Press Enter or click "Send"
3. **Expected**:
   - Your message appears in chat
   - Response appears (if LLM is configured)
   - Error message if LLM not configured

### Test 8: Simple Stats

1. Create a few workbooks
2. Add some documents
3. **Expected**: Stats at bottom of sidebar show:
   - Workbook count
   - Document count

### Test 9: Multiple Tabs

1. Open multiple documents
2. **Expected**:
   - Each document opens in a new tab
   - Can switch between tabs
   - Can close tabs with × button

### Test 10: File Operations

1. Right-click on a document (when implemented)
2. Test rename, delete, move operations
3. **Expected**: Operations work correctly

## Testing Checklist

- [ ] Application launches without errors
- [ ] Can create a workbook
- [ ] Can add files via file dialog
- [ ] Can add files via drag and drop
- [ ] Can view markdown files (rendered)
- [ ] Can view CSV files (table)
- [ ] Can view text files (editor)
- [ ] Can rename workbook
- [ ] Can delete workbook
- [ ] Can archive workbook
- [ ] Can see archived workbooks
- [ ] Stats display correctly
- [ ] Chat works (if LLM configured)
- [ ] Multiple tabs work
- [ ] Right-click context menu works

## Troubleshooting

### Issue: Application won't start

**Check:**

1. Node.js version: `node --version` (should be 20+)
2. Dependencies installed: `npm install`
3. TypeScript compilation: `npm run build:electron`

**Solution:**

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Issue: Electron window doesn't open

**Check:**

1. Check console for errors
2. Look for TypeScript compilation errors
3. Check if Vite dev server is running (should be on port 5173)

**Solution:**

```bash
# Run components separately to see errors
npm run build:electron
npm run dev:react
# Then in another terminal:
npm run dev:electron
```

### Issue: Chat doesn't work

**Check:**

1. LLM config file exists: `config/llm.yaml`
2. API key is set (if using OpenAI/Claude)
3. Ollama is running (if using Ollama)
4. Check browser console for errors

**Solution:**

- For OpenAI/Claude: Set environment variable
- For Ollama: Start Ollama service
- For testing: You can skip chat and test other features

### Issue: Files not appearing

**Check:**

1. Files are being added to correct workbook
2. Check data directory: `%APPDATA%/insightLM-LT/workbooks/`
3. Check browser console for errors

**Solution:**

- Refresh workbooks (reload app)
- Check file permissions
- Verify workbook.json exists in workbook folder

### Issue: Drag and drop doesn't work

**Check:**

1. Dragging from Windows Explorer (not from within app)
2. Dropping on workbook name (not empty space)
3. Check browser console for errors

**Solution:**

- Use file dialog as alternative
- Check Electron version compatibility

## Manual Testing Scenarios

### Scenario 1: New User Workflow

1. Launch app
2. Create first workbook: "My First Workbook"
3. Add a markdown file with some content
4. View the markdown file
5. Add a CSV file
6. View the CSV file
7. Try chatting about the documents (if LLM configured)

**Expected**: Smooth workflow, no errors

### Scenario 2: Multiple Workbooks

1. Create 3 workbooks with different names
2. Add different files to each
3. Switch between viewing documents from different workbooks
4. Archive one workbook
5. Verify stats update

**Expected**: All workbooks work independently, archive works

### Scenario 3: File Management

1. Create a workbook
2. Add multiple files
3. Rename a file (when implemented)
4. Delete a file (when implemented)
5. Move a file between workbooks (when implemented)

**Expected**: File operations work correctly

## Automated Testing (Future)

Currently, testing is manual. Future additions:

- Unit tests for services
- Integration tests for IPC
- E2E tests with Playwright or Spectron

## Performance Testing

### Test Large Files

1. Add a large CSV file (1000+ rows)
2. Add a large text file (10MB+)
3. **Expected**: Files load without freezing UI

### Test Many Workbooks

1. Create 20+ workbooks
2. Add files to each
3. **Expected**: UI remains responsive

## Known Limitations

- PDF viewer is placeholder (needs react-pdf setup)
- File watching not yet implemented
- Export/import not yet implemented
- MCP servers are placeholders (need full protocol)
- Some error handling could be improved

## Reporting Issues

When reporting issues, include:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Error messages (from console)
5. OS version
6. Node.js version
