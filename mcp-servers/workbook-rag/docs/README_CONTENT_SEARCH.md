# Content Search RAG - Implementation Guide

## Overview

The content search RAG system provides semantic search across workbook documents (PDFs, Word docs, text files) using simple text matching with relevance scoring.

## Features

✅ **Content Search** - Searches inside PDFs, Word docs, and text files (not just filenames)
✅ **Relevance Scoring** - Smart scoring based on exact phrase matches, word matches, filename matches
✅ **Full Content** - Returns up to 10,000 characters per file for complete context
✅ **Sibling Files** - Includes all files from matching workbooks for better context
✅ **Caching** - In-memory cache with mtime checks for performance
✅ **Simple** - No vector database needed, just text matching

## How It Works

### Search Flow

1. User asks question: "What is BSEO?"
2. LLM calls `rag_search_content("BSEO")`
3. RAG server searches all documents:
   - Extracts text from PDFs, Word docs, text files
   - Calculates relevance scores
   - Returns top matching files with full content
4. LLM reads the content and answers based on actual documents

### Relevance Scoring

- **Exact phrase match**: 20 points
- **Word matches**: 3 points per word (words > 2 chars)
- **Filename match**: 5 points per word
- **Workbook name match**: 2 points per word
- **PDF boost**: +2 points (if already matched)

### MCP Methods

#### `rag/search_content`
Searches document content and returns full content of matching files.

**Parameters:**
- `query` (required): Search query
- `limit` (optional): Max workbooks to return (default: 5)

**Returns:**
- Full content of matching files (up to 10,000 chars per file)
- Relevance scores
- Sibling files from same workbooks

## Testing

Run the content search tests:

```bash
npm run test:rag
```

Or directly:

```bash
cd mcp-servers/workbook-rag
python test_content_search_simple.py
```

## Integration

### LLM Service Integration

The `rag_search_content` tool is available to the LLM:

```typescript
{
  name: "rag_search_content",
  description: "Search document CONTENT (not just filenames) across all workbooks...",
  parameters: {
    query: "What to search for",
    limit: "Max workbooks (default: 5)"
  }
}
```

### System Prompt

The LLM is instructed to use `rag_search_content` when:
- Users ask about specific terms/concepts
- Information might be inside documents (not just filenames)
- Need to search document content, not just metadata

## Performance

- **Caching**: Content is cached in memory with mtime checks
- **Speed**: Fast (cached content, no vector DB overhead)
- **Memory**: Efficient (caching with automatic invalidation)
- **Scalability**: Handles multiple workbooks well

## Example Usage

**User**: "What is BSEO?"

**LLM Response**:
1. Calls `rag_search_content("BSEO")`
2. Gets results with full PDF content containing BSEO
3. Answers: "BSEO is..." based on actual document content

## Files

- `server.py` - RAG server with content search
- `test_content_search_simple.py` - Integration tests
- `requirements.txt` - Python dependencies (pypdf, python-docx)

## Dependencies

- `pypdf>=3.0.0` - PDF text extraction
- `python-docx>=1.0.0` - Word document text extraction

## Future Enhancements

- Optional vector search for semantic similarity
- Hybrid search (keyword + semantic)
- Incremental indexing
- Reranking for better relevance

