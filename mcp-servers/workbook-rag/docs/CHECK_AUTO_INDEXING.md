# How to Check if Auto-Indexing is Working

## What Should Happen

When you drag and drop files:
1. Files are added to the workbook ✅
2. Auto-indexing triggers automatically ✅
3. Full re-index runs (batches multiple files) ✅
4. Console shows indexing progress ✅

## How to Verify

### 1. Check Console Logs

Open the Electron app's developer console (View → Toggle Developer Tools) and look for:

**When files are added:**
```
[RAG Index] Starting RAG indexing: C:\Users\JohnDeHart\AppData\Roaming\insightLM-LT
[RAG Index] Indexing workbook: Your Workbook Name (X documents)
[RAG Index]   Processing filename.pdf: 3 chunks
[RAG Index]   Processing document.docx: 2 chunks
[RAG Index] ✅ Indexing complete!
```

**If there's an error:**
```
Error auto-indexing file: [error message]
```

### 2. Check Database Updated

After adding files, verify the database was updated:

```powershell
# Check database exists and was recently modified
Get-Item "$env:APPDATA\insightLM-LT\rag_db" | Select-Object LastWriteTime
```

### 3. Test Search

After adding files, wait a few seconds for indexing to complete, then test search:

```powershell
cd mcp-servers\workbook-rag
.\.venv\Scripts\python.exe test_server.py search
```

Search for content from the files you just added.

## Troubleshooting

### No Indexing Messages in Console

**Possible causes:**
1. RAGIndexService not initialized
2. Database doesn't exist yet (need initial manual index)
3. OpenAI API key not configured

**Solution:**
- Run manual indexing first: `.\.venv\Scripts\python.exe index.py "$env:APPDATA\insightLM-LT"`
- Check console for initialization messages
- Verify API key is set

### Indexing Errors

**Error**: "OpenAI API key not configured"
- **Solution**: Check `config/llm.yaml` has `apiKey: "${OPENAI_API_KEY}"` and env var is set

**Error**: "Index script not found"
- **Solution**: Verify `mcp-servers/workbook-rag/index.py` exists

**Error**: "Database not found"
- **Solution**: Run manual indexing first to create database

### Files Not Appearing in Search

**Possible causes:**
1. Indexing still in progress (wait a few seconds)
2. File format not supported
3. Indexing failed silently

**Solution:**
- Check console for completion message
- Verify file format is supported (PDF, DOCX, Excel, text files)
- Check for error messages in console

## Expected Behavior

- **First file added**: Triggers indexing after 1 second delay
- **Multiple files added quickly**: Batched together, single indexing run
- **File updated**: Triggers re-indexing
- **File deleted**: Triggers re-indexing (removes from index)

## Quick Check

Run this to see if indexing happened:

```powershell
# Check if database was modified recently (within last 5 minutes)
$dbPath = "$env:APPDATA\insightLM-LT\rag_db"
if (Test-Path $dbPath) {
    $lastWrite = (Get-Item $dbPath).LastWriteTime
    $timeDiff = (Get-Date) - $lastWrite
    if ($timeDiff.TotalMinutes -lt 5) {
        Write-Host "✅ Database updated recently ($([math]::Round($timeDiff.TotalSeconds, 1)) seconds ago)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Database not updated recently ($([math]::Round($timeDiff.TotalMinutes, 1)) minutes ago)" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Database not found - run manual indexing first" -ForegroundColor Red
}
```



