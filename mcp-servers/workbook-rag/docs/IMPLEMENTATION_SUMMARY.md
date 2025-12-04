# Workbook RAG Implementation Summary

## Overview

This MCP server implements a RAG (Retrieval-Augmented Generation) system for workbook documents using an **on-demand reading approach**, inspired by [Continue.dev's implementation](https://docs.continue.dev/guides/custom-code-rag). Unlike traditional RAG systems that pre-index documents into a vector database, this server reads files directly when requested by the LLM.

## Implementation Approach

### On-Demand Reading (Continue.dev Style)

The server follows Continue.dev's philosophy: **read files when needed, not before**. This means:

1. **No Pre-Indexing**: Files are not processed or embedded ahead of time
2. **Direct File Access**: When the LLM needs information, it requests specific files
3. **Simple Protocol**: Uses a straightforward JSON-based MCP protocol (not the official MCP SDK)
4. **Multi-Format Support**: Can extract text from PDFs, DOCX, Excel, PowerPoint, and text files

### How It Works

1. **LLM Requests Files**: The LLM uses tools (`list_all_workbook_files`, `read_workbook_file`) to discover and read files
2. **Server Reads On-Demand**: When `read_workbook_file` is called, the server:
   - Locates the file in the workbook structure
   - Detects the file format
   - Extracts text using appropriate libraries (pypdf, python-docx, etc.)
   - Returns the content immediately
3. **LLM Uses Content**: The LLM incorporates the file content into its response

### Available MCP Methods

- `rag/list_files`: Lists all files across all workbooks
- `rag/search`: Simple filename-based search (not semantic search)
- `rag/read_file`: Reads and extracts text from a specific file on-demand
- `rag/health`: Server health check

## Why Indexing Is Bad (For This Use Case)

### Problems with Pre-Indexing:

1. **Slow Initial Setup**: Indexing large document sets can take minutes or hours
2. **Stale Data**: Index becomes outdated as files change, requiring re-indexing
3. **Storage Overhead**: Vector databases consume significant disk space
4. **Complexity**: Requires managing embeddings, chunking strategies, and database updates
5. **Not Needed**: For document Q&A, the LLM can read entire files directly - no need for semantic search when you know which file to read

### Why On-Demand Works Better:

1. **Always Fresh**: Files are read directly from disk - always up-to-date
2. **Fast Startup**: No indexing delay - server starts immediately
3. **Simple**: No database to manage, no embeddings to generate
4. **Flexible**: LLM decides what to read based on context
5. **Efficient**: Only reads files that are actually needed

## What We Copied from Continue.dev

- **On-demand file reading** instead of pre-indexing
- **Simple file listing and reading** tools for the LLM
- **Direct text extraction** from various file formats
- **LLM-driven file discovery** - let the LLM figure out what files to read

## What's Good ✅

1. **Fast Startup**: No indexing delay - server is ready immediately
2. **Always Current**: Files are read fresh from disk every time
3. **Simple Architecture**: No vector database, no embeddings, no chunking logic
4. **Multi-Format Support**: Handles PDFs, DOCX, Excel, PowerPoint, and text files
5. **LLM Integration**: Works seamlessly with OpenAI's tool calling
6. **File References**: Tracks which files were read and displays them as clickable links
7. **Error Handling**: Gracefully handles missing files and extraction errors

## What's Bad ❌

1. **No Semantic Search**: Can't search by meaning - only by filename
2. **Limited Discovery**: LLM must know or guess filenames to find relevant content
3. **Large File Handling**: Reading entire large files can be slow and hit token limits
4. **No Chunking**: Can't retrieve specific sections of large documents
5. **Simple Search**: The `rag/search` method only does filename matching, not content search
6. **No Caching**: Reads files from disk every time, even if recently accessed
7. **Source Links**: The source link formatting in chat needs improvement (currently being worked on)

## What Still Needs to Be Done 🔧

### High Priority - Core Functionality

1. **Complete File Format Support**:
   - ✅ **PDF**: Currently supported via pypdf
   - ✅ **Word Documents (DOCX/DOC)**: Currently supported via python-docx
   - ✅ **Excel Spreadsheets (XLSX/XLS)**: Currently supported via pandas/openpyxl
   - ✅ **CSV Files**: Currently supported (read as text)
   - ⚠️ **Table Rendering**: Need better table extraction and formatting from Excel/CSV
   - ⚠️ **PowerPoint (PPTX/PPT)**: Partially supported, needs testing
   - 🔲 **Other Formats**: RTF, OpenDocument (ODT, ODS, ODP) - stretch goal

2. **Chat Writing Capabilities**:
   - 🔲 **Write Markdown Files**: LLM should be able to create/edit markdown files in workbooks
   - 🔲 **Write Other Text Files**: Support creating code files, config files, etc.
   - 🔲 **File Editing**: Ability to update existing files, not just create new ones
   - 🔲 **File Management**: Rename, move, delete files via chat commands

3. **Workbook Management**:
   - 🔲 **Create Workbooks**: LLM should be able to create new workbooks via chat
   - 🔲 **Organize Workbooks**: Move files between workbooks, rename workbooks
   - 🔲 **Workbook Metadata**: Set descriptions, tags, or other metadata

4. **Mermaid Diagram Rendering**:
   - 🔲 **Render in Chat**: Display Mermaid diagrams inline in chat messages
   - 🔲 **Support All Mermaid Types**: Flowcharts, sequence diagrams, Gantt charts, etc.
   - 🔲 **Interactive Diagrams**: Clickable elements, zoom, export options

5. **Improve Source Display**:
   - ⚠️ **Better Formatting**: Smaller, tighter layout (in progress)
   - ⚠️ **Each Source on Own Line**: Proper markdown line breaks (in progress)
   - ⚠️ **Clickable Links**: Links that open files in tabs (in progress)

### Medium Priority

6. **Better File Discovery**:
   - Add semantic search capability (optional, for when LLM doesn't know filenames)
   - Improve `rag/search` to search file contents, not just filenames
   - Add file metadata (size, modified date, etc.) to help LLM choose files

7. **Large File Handling**:
   - Implement chunking for files that exceed token limits
   - Add `rag/read_file_chunk` method to read specific sections
   - Truncate or summarize very large files automatically

8. **Dashboard Creation** (Future):
   - 🔲 **Create Dashboards**: LLM should be able to create dashboards via chat
   - 🔲 **Dashboard Components**: Add charts, tables, visualizations
   - 🔲 **Data Binding**: Connect dashboards to workbook data
   - 🔲 **Dashboard Templates**: Pre-built dashboard templates for common use cases

9. **Caching**:
   - Cache recently read files in memory
   - Invalidate cache when files are modified
   - Reduce disk I/O for frequently accessed files

10. **Better Error Messages**:
    - More descriptive errors when files can't be read
    - Suggestions for similar filenames when file not found
    - Better handling of corrupted or unsupported files

### Low Priority / Stretch Goals

11. **Performance Optimization**:
    - Parallel file reading for multiple files
    - Streaming for very large files
    - Lazy loading of extraction libraries

12. **Advanced Table Support**:
    - Better CSV parsing with proper delimiter detection
    - Table visualization in chat (not just text)
    - Table editing capabilities
    - Export tables to Excel/CSV

13. **Image Support**:
    - Display images in chat messages
    - OCR for images containing text
    - Image annotations and markup

14. **Code Execution** (Stretch):
    - Execute code snippets in chat (sandboxed)
    - Run Python scripts from workbooks
    - Generate and run SQL queries

15. **Collaboration Features**:
    - Share workbooks with other users
    - Comment on files and dashboards
    - Version history for files

16. **Advanced Search**:
    - Full-text search across all workbooks
    - Semantic search using embeddings (optional)
    - Search by file content, not just filenames
    - Search filters (date range, file type, workbook, etc.)

17. **File Relationships**:
    - Track file dependencies
    - Show which files reference other files
    - Visualize file relationships in a graph

18. **Templates and Scaffolding**:
    - LLM can use templates to create new files
    - Project scaffolding (create entire project structures)
    - Code generation from specifications

19. **Export/Import**:
    - Export workbooks to various formats
    - Import from external sources (GitHub, Google Drive, etc.)
    - Backup and restore workbooks

20. **Hybrid Approach** (Optional):
    - Keep on-demand reading as primary
    - Add optional indexing for semantic search when needed
    - Let user choose: fast on-demand vs. indexed search

21. **Metadata Extraction**:
    - Extract document metadata (author, creation date, etc.)
    - Extract table structures from Excel/DOCX
    - Extract slide notes from PowerPoint
    - Auto-tag files based on content

22. **AI-Powered Features**:
    - Auto-summarize long documents
    - Auto-generate file descriptions
    - Suggest file organization
    - Detect duplicate content

## Technical Details

### File Format Support

- **PDF**: Uses `pypdf` for text extraction
- **DOCX**: Uses `python-docx` for text and table extraction
- **Excel**: Uses `pandas` and `openpyxl` for sheet extraction
- **PowerPoint**: Uses `python-pptx` for slide text extraction
- **Text Files**: Direct reading (Markdown, CSV, code files, etc.)

### Environment Variables

- `OPENAI_API_KEY`: Required for any future embedding features (currently not used)
- `INSIGHTLM_DATA_DIR`: Application data directory (auto-detected if not set)

### Dependencies

See `requirements.txt` for full list. Key libraries:
- `pypdf`: PDF text extraction
- `python-docx`: DOCX text extraction
- `pandas` + `openpyxl`: Excel extraction
- `python-pptx`: PowerPoint extraction

## Architecture Decision: Why Not Use Official MCP SDK?

We use a simple JSON-based protocol instead of the official MCP SDK because:

1. **Simplicity**: Our needs are simple - just file reading
2. **Control**: Full control over the protocol and error handling
3. **Lightweight**: No heavy SDK dependencies
4. **Compatibility**: Works with our existing Electron IPC system

This may change in the future if we need more advanced MCP features.
