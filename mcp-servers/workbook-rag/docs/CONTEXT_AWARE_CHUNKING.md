# Context-Aware Chunking Implementation

## Overview

Instead of returning the first N characters of a document, the RAG system now extracts **context chunks** around where keywords are found in the document. This allows the LLM to see relevant information even if it's on page 50 of a 300-page PDF.

## How It Works

### Traditional Approach (Old)
```
User: "What compliance standards does ODRAS meet?"
  ↓
RAG finds: odras_tool_overview.pdf (45,000 chars)
  ↓
Returns: First 10,000 chars to LLM
  ↓
Problem: Compliance info is at char 35,000 - LLM never sees it ❌
```

### Context-Aware Approach (New)
```
User: "What compliance standards does ODRAS meet?"
  ↓
Extract keywords: ["compliance", "standards", "odras"]
  ↓
Search document for keyword positions:
  - "compliance" found at position 35,000
  - "standards" found at position 42,000
  ↓
Extract chunks around those positions:
  - Chunk 1: chars 34,500-35,500 (1,000 chars around "compliance")
  - Chunk 2: chars 41,500-42,500 (1,000 chars around "standards")
  ↓
Return 2 chunks (~2,000 chars total) to LLM
  ↓
LLM sees the RELEVANT parts ✅
```

## Implementation Details

### Function: `extract_context_chunks()`

**Parameters:**
- `content` - Full document content
- `key_terms` - Keywords to search for
- `chunk_size` - Total chunk size (default: 1,000 chars)
- `max_chunks` - Maximum chunks to return (default: 5)

**Logic:**
1. Search content for each keyword using word boundaries (`\b`)
2. For each match, extract chunk (500 chars before + 500 chars after)
3. Break at word boundaries (not mid-word)
4. Add ellipsis (...) if not at document boundaries
5. Avoid overlapping chunks
6. Return chunks sorted by position

**Example output:**
```
[Excerpt 1 - Position 35,240]
...Federal compliance standards including FAA Part 23, DO-178C for software,
and DO-254 for hardware. The system must meet MIL-STD-498 for documentation
and IEEE 830 for requirements specification...

[Excerpt 2 - Position 42,108]
...Industry standards such as ISO 9001 for quality management and ISO 27001
for information security must be demonstrated through regular audits...
```

## Fallback Behavior

If no keywords are found in the document:
- Returns first 2,000 characters as preview
- Includes message: "Use read_workbook_file to get complete document"

## Benefits

1. **Finds info anywhere** - Not limited to first 10K chars
2. **Token-efficient** - Sends only relevant sections (~2K chars instead of 45K)
3. **Scalable** - Works with 300-page documents
4. **Smart** - Shows context around answers, not random document start
5. **Flexible** - LLM can request full document if needed

## Configuration

- **Chunk size**: 1,000 chars (500 before + 500 after keyword)
- **Max chunks**: 5 per document
- **Max total**: Up to ~5,000 chars per document (vs 10,000 before)

## LLM Workflow

The LLM now has two options:

1. **Answer from chunks** - If chunks contain enough information
2. **Read full document** - Call `read_workbook_file(workbookId, path)` to get complete content

This gives the LLM flexibility while being token-efficient by default.

## Performance

- **Speed**: Same (uses same in-memory cache)
- **Memory**: Same (still loads full content for searching)
- **Tokens**: 75% reduction (2K vs 10K chars per file)
- **Accuracy**: Improved (finds info anywhere in document)

## Example Responses

### Short excerpt (keyword found once)
```
**document.pdf** (Workbook)
Chunks: 1 excerpt (1,042 characters total)

=== CONTEXT EXCERPTS (around keywords: compliance, standards) ===
[Excerpt 1 - Position 35,240]
...Federal compliance standards including FAA Part 23...
```

### Multiple excerpts (keyword found multiple times)
```
**document.pdf** (Workbook)
Chunks: 3 excerpts (3,156 characters total)

=== CONTEXT EXCERPTS (around keywords: system, architecture) ===
[Excerpt 1 - Position 1,250]
...system architecture follows a modular design...

[Excerpt 2 - Position 15,680]
...The architecture supports distributed deployment...

[Excerpt 3 - Position 28,940]
...System interfaces use REST APIs for communication...
```

### No keywords found (fallback)
```
**document.pdf** (Workbook)
Total Length: 45,000 characters

=== PREVIEW (first 2,000 chars) ===
[Beginning of document...]

[NOTE: Use read_workbook_file to get complete document.]
```












