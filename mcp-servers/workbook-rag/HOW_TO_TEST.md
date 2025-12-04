# How to Test the RAG System

## Prerequisites

- ✅ Virtual environment created (`.venv`)
- ✅ Dependencies installed
- ✅ OpenAI API key set as Windows environment variable
- ✅ At least one workbook with documents

## Step 1: Test Indexing Script

### 1.1 Find Your Data Directory

Your data directory is typically:
```
C:\Users\JohnDeHart\AppData\Roaming\insightLM-LT
```

Or check your `config/app.yaml` file for the exact path.

### 1.2 Run Indexing

Open PowerShell in the `mcp-servers\workbook-rag` directory:

```powershell
cd mcp-servers\workbook-rag

# Activate venv (if not already active)
.\.venv\Scripts\Activate.ps1

# Run indexing
python index.py "$env:APPDATA\insightLM-LT"
```

**Expected Output:**
```
Starting indexing...
  Data directory: C:\Users\JohnDeHart\AppData\Roaming\insightLM-LT
  Database path: C:\Users\JohnDeHart\AppData\Roaming\insightLM-LT\rag_db
  Embedding model: text-embedding-3-small
  Max chunk size: 8000 tokens

Indexing workbook: My Workbook (5 documents)
  Processing example.txt: 1 chunks
  Processing document.pdf: 3 chunks
  Inserted batch 1 (4 chunks)

✅ Indexing complete!
   Files indexed: 5
   Total chunks: 4
   Database location: C:\Users\JohnDeHart\AppData\Roaming\insightLM-LT\rag_db
```

### 1.3 Verify Database Created

Check that the database directory exists:
```powershell
Test-Path "$env:APPDATA\insightLM-LT\rag_db"
# Should return: True
```

## Step 2: Test RAG Server Directly

### 2.1 Test Health Check

```powershell
cd mcp-servers\workbook-rag
.\.venv\Scripts\python.exe -c "from server import handle_request; import json; result = handle_request({'method': 'rag/health', 'params': {}}); print(json.dumps(result, indent=2))"
```

**Expected Output:**
```json
{
  "result": {
    "status": "healthy",
    "database_connected": true,
    "embedding_model": "text-embedding-3-small"
  }
}
```

### 2.2 Test Search

```powershell
.\.venv\Scripts\python.exe -c "from server import handle_request; import json; result = handle_request({'method': 'rag/search', 'params': {'query': 'your search term', 'limit': 5}}); print(json.dumps(result, indent=2))"
```

Replace `'your search term'` with actual content from your indexed files.

**Expected Output:**
```json
{
  "result": [
    {
      "workbook_id": "workbook-123",
      "filename": "example.txt",
      "file_path": "documents/example.txt",
      "chunk_index": 0,
      "text": "relevant text content..."
    }
  ]
}
```

### 2.3 Test File Context

```powershell
.\.venv\Scripts\python.exe -c "from server import handle_request; import json; result = handle_request({'method': 'rag/get_file_context', 'params': {'filename': 'example.txt'}}); print(json.dumps(result, indent=2))"
```

Replace `'example.txt'` with an actual filename from your indexed files.

## Step 3: Test with Test Script

Use the provided test script:

```powershell
cd mcp-servers\workbook-rag
.\.venv\Scripts\python.exe test_server.py health
.\.venv\Scripts\python.exe test_server.py search
```

## Step 4: Test Different File Formats

### 4.1 Test PDF Indexing

1. Add a PDF file to a workbook
2. Run indexing script
3. Search for content from the PDF
4. Verify results include PDF content

### 4.2 Test DOCX Indexing

1. Add a Word document to a workbook
2. Run indexing script
3. Search for content from the document
4. Verify results include document content

### 4.3 Test Excel Indexing

1. Add an Excel file with multiple sheets
2. Run indexing script
3. Search for content from any sheet
4. Verify results include Excel content

## Step 5: Test Auto-Indexing (Integration)

### 5.1 Start the Electron App

```powershell
cd C:\Users\JohnDeHart\working\insightLM-LT
npm run dev
```

### 5.2 Add a File via UI

1. Open insightLM-LT
2. Create or open a workbook
3. Add a new file (drag & drop or right-click → Add File)
4. Check console logs for indexing messages

**Expected Console Output:**
```
[RAG Index] Starting RAG indexing: C:\Users\JohnDeHart\AppData\Roaming\insightLM-LT
[RAG Index] Indexing workbook: My Workbook (1 documents)
[RAG Index]   Processing newfile.txt: 1 chunks
[RAG Index] ✅ Indexing complete!
```

### 5.3 Update a File

1. Edit an existing file
2. Save changes (Ctrl+S)
3. Check console for re-indexing messages

### 5.4 Delete a File

1. Delete a file from workbook
2. Check console for removal messages

## Step 6: Test Search via MCP Server

The MCP server should be running automatically when you start insightLM-LT. To test it:

### 6.1 Check Server is Running

Look for console output:
```
MCP server workbook-rag started
```

### 6.2 Test via Application

Currently, the RAG search isn't integrated into the LLM service yet, but you can verify the server is running by checking the console logs.

## Step 7: Test Large Files

### 7.1 Add Large File

1. Add a file > 100KB
2. Run indexing
3. Verify it's split into multiple chunks
4. Check chunk_index values are sequential

### 7.2 Verify Chunking

Search for content and verify:
- Multiple chunks returned for same file
- Chunks have overlap (content appears in adjacent chunks)
- All chunks are searchable

## Troubleshooting

### Indexing Fails

**Error**: "OPENAI_API_KEY environment variable is required"
- **Solution**: Verify Windows env var is set: `$env:OPENAI_API_KEY`

**Error**: "Database not found"
- **Solution**: Run indexing script first

**Error**: "Module not found"
- **Solution**: Activate venv: `.\.venv\Scripts\Activate.ps1`

### Search Returns No Results

- Verify files were indexed (check indexing output)
- Try broader search terms
- Check database exists: `Test-Path "$env:APPDATA\insightLM-LT\rag_db"`

### PDF/DOCX Not Indexed

- Check file extension is supported
- Verify libraries installed: `pip list | Select-String "pypdf|docx"`
- Check indexing output for errors

## Quick Test Checklist

- [ ] Indexing script runs without errors
- [ ] Database created in correct location
- [ ] Health check returns "healthy"
- [ ] Search returns results
- [ ] File context retrieval works
- [ ] PDF files indexed
- [ ] DOCX files indexed
- [ ] Excel files indexed
- [ ] Large files chunked correctly
- [ ] Auto-indexing triggers on file add
- [ ] Auto-indexing triggers on file update

## Next Steps After Testing

Once basic tests pass:
1. Test with real workbooks and documents
2. Test search quality with various queries
3. Test performance with large codebases
4. Integrate RAG search into LLM service
5. Add chat persistence and indexing

