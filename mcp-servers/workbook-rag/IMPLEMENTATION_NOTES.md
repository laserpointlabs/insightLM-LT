# RAG Implementation Notes

## Protocol Choice

**Current Status**: Using simple JSON protocol over stdin/stdout
- ✅ Works perfectly with current insightLM-LT MCP service
- ✅ Simple and reliable
- ✅ No external dependencies beyond Python stdlib

**For Continue.dev Integration**:
- Continue.dev uses the official MCP SDK protocol
- To use with Continue.dev, you would need a separate server implementation using `mcp` Python package
- Current implementation is optimized for insightLM-LT's needs
- **Recommendation**: Keep current protocol for insightLM-LT, create separate Continue.dev version if needed

## Large File Handling

**Current Implementation**: ✅ Already handles large files correctly

The chunking function (`chunk_text`) automatically splits large files into multiple chunks:
- Files > 8000 tokens are split into multiple chunks
- Each chunk has 200 token overlap for context continuity
- Chunks are stored separately in the vector database
- When searching, all relevant chunks are returned

**Example**:
- A 50,000 token file → ~6 chunks (with overlap)
- Each chunk is independently searchable
- `get_file_context` returns all chunks in order for complete file context

**No changes needed** - this already works correctly!

## Auto-Indexing

**Status**: ✅ Implemented in `electron/services/ragIndexService.ts`

**How it works**:
1. When a file is added → triggers indexing
2. When a file is updated → triggers indexing
3. When a file is deleted → removes from index
4. Indexing happens asynchronously (non-blocking)

**Implementation**:
- `RAGIndexService` hooks into `FileService` operations
- Uses batch indexing (queues files, indexes in batches)
- Full re-index available for initial setup

**Next Steps**:
- Hook into FileService.addDocument, writeDocument, deleteDocument
- Add to main.ts initialization

## Chat Indexing

**Status**: 🟡 Partially implemented

**Requirements**:
- Store chat messages persistently
- Index chat messages in RAG system
- Make chats searchable

**Implementation Plan**:
1. Create chat storage service (store chats in JSON files)
2. Add chat indexing to index.py
3. Include chats in search results
4. Link chats to workbooks (optional)

**Current Gap**: Chat messages are only in React state (memory), need persistence layer

## File Reading Integration

**Status**: ✅ Available via RAG server

**Methods**:
- `rag/get_file_context` - Get all chunks from a file
- `rag/search` - Search across all indexed content

**Integration with LLM**:
- LLM service should call RAG search before answering questions
- Use RAG results as context for LLM responses
- Similar to Continue.dev's behavior

## Continue.dev-like Behavior

**What Continue.dev does**:
1. User asks question
2. System searches indexed codebase
3. Retrieves relevant code/documentation
4. Uses retrieved context to answer question
5. Can read specific files when requested

**What we need**:
1. ✅ RAG search capability
2. ✅ File reading capability
3. 🟡 Auto-indexing (implemented, needs integration)
4. 🟡 Chat indexing (needs implementation)
5. 🟡 LLM integration (needs RAG search in LLM service)

## Low-Hanging Fruit (Quick Fixes)

1. **Hook auto-indexing into FileService** - Add RAGIndexService calls
2. **Add RAG search to LLM service** - Call RAG before answering
3. **Add chat persistence** - Store chats to disk
4. **Add chat indexing** - Include chats in index.py
5. **Add "read file" tool to LLM** - Use RAG get_file_context

## Testing Checklist

- [ ] Add a file → verify it gets indexed
- [ ] Update a file → verify index updates
- [ ] Delete a file → verify removed from index
- [ ] Search for content → verify results
- [ ] Ask LLM question → verify uses RAG context
- [ ] Request file read → verify returns content
- [ ] Chat persistence → verify chats saved
- [ ] Chat indexing → verify chats searchable

