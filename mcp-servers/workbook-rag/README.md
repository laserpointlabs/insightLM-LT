# Workbook RAG MCP Server

## Directory Structure

```
workbook-rag/
├── server.py              # Main server implementation
├── config.json            # MCP server configuration
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── docs/                 # Documentation
│   ├── README.md         # Documentation index
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── IMPLEMENTATION_NOTES.md
│   ├── ON_DEMAND_READING.md
│   ├── README_CONTENT_SEARCH.md
│   ├── FILE_FORMATS.md
│   ├── HOW_TO_TEST.md
│   ├── CHECK_AUTO_INDEXING.md
│   └── TEST_RESULTS.md
└── tests/                # Test files
    ├── test_content_search_simple.py
    ├── test_rag.py
    └── test_llm_flow.py
```

## Quick Start

Custom RAG (Retrieval-Augmented Generation) system for workbook documents using OpenAI embeddings and LanceDB, following [Continue.dev's custom RAG guide](https://docs.continue.dev/guides/custom-code-rag).

## Features

- **Vector Search**: Semantic search across all indexed workbook documents
- **OpenAI Embeddings**: Uses `text-embedding-3-small` for generating embeddings
- **LanceDB**: Fast, local vector database for storing embeddings
- **Chunking**: Intelligent text chunking with overlap for better context
- **File Context**: Retrieve complete file context by filename
- **Multi-Format Support**: Indexes PDFs, Word docs, Excel files, PowerPoint, and more

## Supported File Formats

The RAG system can index and search across multiple file formats:

### Text Files
- **Code**: `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.java`, `.cpp`, `.c`, `.go`, `.rs`, `.rb`, `.php`, `.swift`, `.kt`, `.scala`, etc.
- **Markup**: `.md`, `.markdown`, `.html`, `.xml`, `.json`, `.yaml`, `.yml`
- **Data**: `.csv`, `.tsv`, `.txt`, `.log`, `.ini`, `.toml`, `.env`
- **Config**: `.conf`, `.config`, `.sh`, `.bash`, `.ps1`

### Document Formats (Text Extraction)
- **PDF**: `.pdf` - Full text extraction from all pages
- **Word**: `.docx`, `.doc` - Text and table extraction
- **Excel**: `.xlsx`, `.xls` - All sheets extracted as text
- **PowerPoint**: `.pptx`, `.ppt` - Slide text extraction

### Future Support
- OpenDocument formats (`.odt`, `.ods`, `.odp`)
- RTF (`.rtf`)
- Other formats as needed

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

The server requires the following environment variables:

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `INSIGHTLM_DATA_DIR`: Path to application data directory (optional, will auto-detect)
- `INSIGHTLM_RAG_DB_PATH`: Path to LanceDB database (optional, defaults to `{data_dir}/rag_db`)

### 3. Index Your Workbooks

Before using the RAG server, you need to index your workbooks:

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Set your data directory (where workbooks are stored)
export INSIGHTLM_DATA_DIR="C:\Users\YourName\AppData\Roaming\insightLM-LT"

# Run the indexing script
python index.py "$INSIGHTLM_DATA_DIR"
```

The indexing script will:
1. Read all workbooks from `{data_dir}/workbooks/`
2. Process all supported files in each workbook (PDFs, Word docs, Excel, text files, etc.)
3. Extract text from binary formats (PDF, DOCX, XLSX, PPTX)
4. Chunk the text into manageable pieces
5. Generate embeddings using OpenAI
6. Store everything in LanceDB

**Note**: The script automatically detects file types and uses appropriate extraction methods:
- Text files: Read directly
- PDFs: Extract text using pypdf
- Word docs: Extract text and tables using python-docx
- Excel: Extract all sheets using pandas/openpyxl
- PowerPoint: Extract slide text using python-pptx

**Note**: Indexing can take a while for large codebases. You can re-run the indexing script to update the index when files change.

### 4. Configure the MCP Server

The server is configured in `config.json`. Make sure it's enabled. The server will automatically pick up environment variables from the system environment.

**Important**: Set the following environment variables before starting insightLM-LT:

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `INSIGHTLM_DATA_DIR`: Path to application data directory (optional, will auto-detect)
- `INSIGHTLM_RAG_DB_PATH`: Path to LanceDB database (optional, defaults to `{data_dir}/rag_db`)

The server configuration in `config.json` should look like:

```json
{
  "name": "workbook-rag",
  "description": "Vector search for workbook documents",
  "command": "python",
  "args": ["server.py"],
  "enabled": true
}
```

## Usage

### Available Tools

#### `search_codebase`

Search for relevant code or documentation using semantic similarity.

**Parameters:**
- `query` (required): The search query
- `limit` (optional): Maximum number of results (default: 10)
- `workbook_id` (optional): Filter results to a specific workbook

**Example:**
```json
{
  "query": "How does authentication work?",
  "limit": 5
}
```

#### `get_file_context`

Get all chunks from a specific file.

**Parameters:**
- `filename` (required): The name of the file to retrieve
- `workbook_id` (optional): Specify workbook if filename exists in multiple workbooks

**Example:**
```json
{
  "filename": "auth.ts",
  "workbook_id": "workbook-123"
}
```

## Architecture

### Chunking Strategy

The indexing script uses a simple fixed-size chunking strategy:
- **Max chunk size**: 8000 tokens (~32,000 characters)
- **Overlap**: 200 tokens (~800 characters) between chunks
- **Break points**: Prefers breaking at newlines or spaces to avoid splitting words

For most use cases, this provides good results. For more sophisticated chunking (AST-based), see Continue's guide.

### Embedding Model

Uses OpenAI's `text-embedding-3-small` model:
- **Dimension**: 1536
- **Max tokens**: 8191 per input
- **Cost**: Very affordable for large-scale indexing

### Vector Database

LanceDB is used for vector storage:
- **Location**: `{data_dir}/rag_db` by default
- **Table**: `code_chunks`
- **Schema**: Includes workbook_id, filename, file_path, chunk_index, text, and vector

## Re-indexing

When your codebase changes, re-run the indexing script:

```bash
python index.py "$INSIGHTLM_DATA_DIR"
```

The script will overwrite the existing index. For incremental updates, you would need to modify the script to track file modification times and only re-index changed files.

## Troubleshooting

### Database not found

If you get "Database not found" errors:
1. Make sure you've run the indexing script first
2. Check that `INSIGHTLM_RAG_DB_PATH` points to the correct location
3. Verify the database directory exists

### No results returned

If searches return no results:
1. Verify your workbooks have been indexed
2. Check that the files you're searching for are text files (not binary)
3. Try a broader search query

### OpenAI API errors

If you get OpenAI API errors:
1. Verify your `OPENAI_API_KEY` is set correctly
2. Check your API quota/limits
3. Ensure you have internet connectivity

## Integration with Continue.dev

This server follows the official MCP (Model Context Protocol) specification and can be used with Continue.dev. To use it with Continue:

1. Add to your Continue config (`config.json` or `config.yaml`):

```json
{
  "mcpServers": {
    "workbook-rag": {
      "command": "python",
      "args": ["/path/to/mcp-servers/workbook-rag/server.py"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "INSIGHTLM_DATA_DIR": "${INSIGHTLM_DATA_DIR}",
        "INSIGHTLM_RAG_DB_PATH": "${INSIGHTLM_RAG_DB_PATH}"
      }
    }
  }
}
```

## Future Enhancements

- [ ] Incremental indexing (only re-index changed files)
- [ ] Reranking using Voyage AI's rerank-2 model
- [ ] AST-based chunking for better code understanding
- [ ] Support for multiple embedding models
- [ ] Metadata filtering (file type, date ranges, etc.)
