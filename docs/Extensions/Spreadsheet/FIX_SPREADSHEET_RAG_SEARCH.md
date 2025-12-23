# Fix: LLM Not Finding Timestamped Spreadsheet Files

## Problem
The LLM chat interface could find `test-spreadsheet.is` but failed to find timestamped spreadsheet files like `spreadsheet-2025-12-12T19-46-01.is` when users asked about them.

## Root Cause
1. **System Prompt Not Explicit Enough**: The LLM wasn't consistently using `rag_search_content` when users mentioned filenames, especially timestamped ones. It would sometimes try to use `list_all_workbook_files` or `read_workbook_file` directly without searching first.

2. **Response Parsing Issue**: The MCP server returns `{'result': {'content': '...'}}`, and the MCP service extracts `response.result`, so the result should be `{'content': '...'}`. However, the code only checked `result.content` without a fallback, which could fail if the structure was slightly different.

## Solution

### 1. Enhanced System Prompt (`electron/services/llmService.ts`)

**Before:**
```typescript
CRITICAL: When users ask questions about document content, you MUST:
1. If you don't know which files contain the answer, use rag_search_content to search document CONTENT (searches inside PDFs, Word docs, etc.)
2. If you know the filename, use search_workbooks or list_all_workbook_files
3. Use read_workbook_file to READ the actual file content if needed
```

**After:**
```typescript
CRITICAL: When users ask questions about document content, you MUST:
1. ALWAYS use rag_search_content FIRST when users mention filenames or ask about document content (e.g., "what is in spreadsheet-2025-12-12T19-46-01.is", "what is cell C1 in test-spreadsheet")
2. rag_search_content searches INSIDE files (PDFs, Word docs, spreadsheets, text files) and will find files by filename or content
3. After rag_search_content returns results, use read_workbook_file with the exact Workbook ID and Path from the search results to read the full file
4. Answer based on what you READ from the files

IMPORTANT: Use rag_search_content when users ask about:
- Filenames (e.g., "spreadsheet-2025-12-12T19-46-01.is", "test-spreadsheet.is")
- Specific terms or concepts (e.g., "What is BSEO?", "authentication methods")
- Information that might be inside documents (not just filenames)
- Questions where you need to search document content, not just metadata
- Cell values or formulas in spreadsheets (e.g., "what is cell C1")

DO NOT try to answer questions about document content without searching or reading the files first.
DO NOT use list_all_workbook_files or read_workbook_file directly without first using rag_search_content to find the file.
```

**Key Changes:**
- Made it explicit that `rag_search_content` should ALWAYS be used FIRST when filenames are mentioned
- Added explicit examples including timestamped filenames
- Added explicit prohibition against using `list_all_workbook_files` or `read_workbook_file` without searching first
- Emphasized that `rag_search_content` searches INSIDE files and finds files by filename

### 2. Improved Response Parsing (`electron/services/llmService.ts`)

**Before:**
```typescript
if (result && result.content) {
  // Parse RAG response to track sources
  this.trackFilesFromRAGResponse(result.content);
  return enhancedContent;
} else {
  return `No content found matching "${query}". Try a different search term or check if documents exist in workbooks.`;
}
```

**After:**
```typescript
console.log(`[LLM] RAG search result structure:`, JSON.stringify(result, null, 2).substring(0, 500));

// Handle response structure: server returns {'result': {'content': '...'}}
// MCP service extracts result, so result is {'content': '...'}
const content = result?.content || result;

if (content && typeof content === 'string' && content.length > 0) {
  // Parse RAG response to track sources
  this.trackFilesFromRAGResponse(content);
  
  // Add explicit instructions for using read_workbook_file with RAG results
  const enhancedContent = content + 
    `\n\n[IMPORTANT: When you need to read a file from the search results above, use read_workbook_file with the exact Workbook ID and Path shown. For example, if you see "Workbook ID: ac1000-main-project" and "Path: documents/spreadsheet-2025-12-12T19-46-01.is", call read_workbook_file(workbookId="ac1000-main-project", filePath="documents/spreadsheet-2025-12-12T19-46-01.is"). The workbook ID is the directory name, not a UUID.]`;
  
  return enhancedContent;
} else {
  console.error(`[LLM] RAG search returned empty or invalid result:`, result);
  return `No content found matching "${query}". Try a different search term or check if documents exist in workbooks.`;
}
```

**Key Changes:**
- Added fallback: `const content = result?.content || result;` to handle cases where the structure might be different
- Added type checking: `typeof content === 'string'` to ensure we have a string
- Added debug logging to see what the RAG search actually returns
- Enhanced error logging to help debug issues

### 3. Backend RAG Search Already Working

The backend RAG search (`mcp-servers/workbook-rag/server.py`) was already correctly handling timestamped filenames:
- It extracts key terms from queries
- It matches filenames partially (e.g., "spreadsheet-2025-12-12" matches "spreadsheet-2025-12-12T19-46-01.is")
- It boosts scores for filename matches
- It includes date prefix matching for timestamped files

The issue was purely in the frontend LLM service not consistently calling the RAG search.

## Testing

### Test Query
```
What is the value of cell C1 in test-spreadsheet.is and what is the value of cell C1 in spreadsheet-2025-12-12T19-46-01.is?
```

### Expected Result
Both spreadsheets should be found and their C1 values returned:
- `test-spreadsheet.is`: Cell C1 = 700 (formula `=sum(A1:B1)`)
- `spreadsheet-2025-12-12T19-46-01.is`: Cell C1 = 350 (formula `=sum(A1:B1)`)

### Verification
1. The LLM should call `rag_search_content` with a query that includes both filenames
2. RAG search should return both files with their Workbook IDs and Paths
3. The LLM should then call `read_workbook_file` for each file using the exact Workbook ID and Path from the search results
4. The response should include values for both spreadsheets

## Files Modified

1. **`electron/services/llmService.ts`**
   - Updated `getSystemPrompt()` method (lines ~238-265)
   - Updated `executeTool()` method for `rag_search_content` case (lines ~402-439)

## Related Files

- **`mcp-servers/workbook-rag/server.py`**: RAG search backend (already working correctly)
- **`electron/services/mcpService.ts`**: MCP service that handles communication with RAG server
- **`electron/services/fileService.ts`**: File reading service used by `read_workbook_file`

## Notes

- The fix ensures the LLM always uses RAG search first, which is more reliable than trying to guess filenames or workbook IDs
- The enhanced system prompt includes explicit examples with timestamped filenames to guide the LLM
- Debug logging was added to help troubleshoot future issues
- The response parsing is now more robust with fallbacks and type checking

## Date Fixed
December 12, 2025
