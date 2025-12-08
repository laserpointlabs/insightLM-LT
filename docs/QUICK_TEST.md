# Quick Test Guide

## Fastest Way to Test

### 1. Install and Run

```bash
cd insightLM-LT
npm install
npm run dev
```

### 2. Basic Test (No LLM Needed)

1. **Create Workbook**: Click "+ New" → Enter name → OK
2. **Add File**: Click workbook → Click "+ Add File" → Select any .txt or .md file
3. **View File**: Click the filename in the tree
4. **Verify**: File content appears in main area

### 3. Test Drag and Drop

1. Open Windows Explorer
2. Drag a file onto a workbook name in the sidebar
3. **Verify**: File appears under workbook

### 4. Test Right-Click Menu

1. Right-click on a workbook
2. **Verify**: Menu shows Rename, Archive, Delete options
3. Try "Rename" → Enter new name → OK
4. **Verify**: Name updates

### 5. Test Archive

1. Right-click workbook → "Archive"
2. **Verify**: Workbook moves to "Archived" section
3. **Verify**: Stats update

### Expected Results

✅ App window opens
✅ Sidebar shows workbooks
✅ Can create workbooks
✅ Can add files
✅ Can view files
✅ Right-click menu works
✅ Archive works
✅ Stats show correct counts

### If Something Doesn't Work

1. Check browser console (F12 in Electron window)
2. Check terminal for errors
3. Verify Node.js version: `node --version` (should be 20+)
4. Try clean install: `rm -rf node_modules && npm install`

### Test Chat (Optional)

1. Set `OPENAI_API_KEY` environment variable
2. Edit `config/llm.yaml`:
   ```yaml
   provider: "openai"
   apiKey: "${OPENAI_API_KEY}"
   model: "gpt-4"
   ```
3. Restart app
4. Type message in chat → Press Enter
5. **Verify**: Response appears (or error if API key invalid)
