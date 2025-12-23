# RAG Content Search Implementation ✅ COMPLETE

## Status: ✅ IMPLEMENTED AND TESTED

This plan has been successfully implemented. The content search RAG system is working and tested.

## Current Problem

**User asks**: "What is the BSEO?"
**Current behavior**: LLM can't find it because:

- `search_workbooks` only searches filenames
- No way to search document content semantically
- LLM has to guess which PDFs to read
- BSEO might be in any PDF, LLM doesn't know which one

## Solution: Hybrid Approach (Best of Both Worlds)

Keep the on-demand reading philosophy but add semantic search as a **discovery tool**.

### Architecture

```
User Question: "What is BSEO?"
    ↓
LLM uses: rag_search_semantic("BSEO")
    ↓
RAG searches vector DB → finds relevant chunks/files
    ↓
Returns: Top 3-5 files that likely contain BSEO
    ↓
LLM reads those files on-demand: read_workbook_file()
    ↓
LLM answers with actual content
```

### Key Principles

1. **RAG for Discovery**: Use vector search to find which files contain the answer
2. **On-Demand Reading**: Still read files fresh from disk (not chunks)
3. **Flexible**: LLM can use semantic search OR filename search OR direct reading
4. **Smart**: LLM decides when to use which approach

## Implementation Steps

### Step 1: Add Semantic Search to RAG Server

**File**: `mcp-servers/workbook-rag/server.py`

Add function:

```python
def semantic_search(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Search using vector similarity in LanceDB"""
    # 1. Generate embedding for query
    # 2. Search LanceDB for similar chunks
    # 3. Return top files (deduplicate by file)
    # 4. Return workbook_id, file_path, relevance_score
```

### Step 2: Expose via MCP Server

Add to `handle_request()`:

```python
elif method == 'rag/search_semantic':
    query = params.get('query', '')
    limit = params.get('limit', 5)
    results = semantic_search(query, limit)
    return {'result': results}
```

### Step 3: Add Tool to LLM Service

**File**: `electron/services/llmService.ts`

Add new tool:

```typescript
{
  name: "rag_search_semantic",
  description: "Search document content semantically to find files containing specific information. Use this when you don't know which files contain the answer to a question.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "What to search for (e.g., 'BSEO', 'authentication', 'expiration dates')"
      },
      limit: {
        type: "number",
        description: "Maximum number of files to return (default: 5)"
      }
    },
    required: ["query"]
  }
}
```

### Step 4: Implement Tool Execution

Call MCP server's `rag/search_semantic` method:

- Send request to workbook-rag MCP server
- Parse results
- Return formatted list of files with relevance scores

### Step 5: Update System Prompt

Tell LLM when to use semantic search:

- "When users ask about specific terms/concepts you don't recognize, use rag_search_semantic to find relevant files"
- "After finding files, read them using read_workbook_file"
- "Combine information from multiple files if needed"

## Benefits

✅ **Finds content inside PDFs** - not just filenames
✅ **Keeps on-demand reading** - files read fresh from disk
✅ **Flexible** - LLM chooses when to use semantic vs filename search
✅ **Smart discovery** - finds relevant files even if LLM doesn't know names
✅ **Doesn't break existing RAG** - adds capability, doesn't replace

## Example Flow

**User**: "What is the BSEO?"

**LLM**:

1. Calls `rag_search_semantic("BSEO")`
2. Gets: `odras_tool_overview.pdf` (score: 0.89), `ontology_driven_workflow.pdf` (score: 0.76)
3. Calls `read_workbook_file(workbookId, "documents/odras_tool_overview.pdf")`
4. Finds BSEO definition in content
5. Answers: "BSEO is..."

## Testing Strategy

1. Test semantic search finds content in PDFs
2. Test LLM uses it appropriately
3. Test it doesn't break existing filename search
4. Test on actual question: "What is BSEO?"

## Risk Mitigation

- **Don't break existing RAG**: Keep filename search working
- **Make it optional**: LLM can still use filename search or direct reading
- **Handle errors gracefully**: If vector DB doesn't exist, fall back to filename search
- **Performance**: Limit results to top 5 files to avoid overwhelming LLM
