# LLM Capabilities - Continue.dev-like Features

## Overview

The LLM integration now supports Continue.dev-like capabilities including tool calling, markdown rendering, file operations, and context awareness.

## Key Features

### 1. Tool Calling (Function Calling)

The LLM can call tools to interact with workbooks:

- **read_workbook_file**: Read contents of files in workbooks
- **list_workbooks**: List all workbooks and their documents
- **create_file_in_workbook**: Create new markdown files with content
- **search_workbooks**: Search for files across workbooks

### 2. Markdown Rendering

- Chat responses render markdown properly (tables, headers, lists, code blocks)
- Files created by LLM use proper markdown formatting
- Tables are rendered correctly in chat

### 3. Context Awareness

- LLM automatically sees available workbooks
- Can read documents to answer questions
- Understands workbook structure

### 4. File Creation

- LLM can create markdown files in workbooks
- Files are automatically added to workbook metadata
- Supports creating summaries, tables, analyses, etc.

## Usage Examples

### Example 1: Ask About Documents

**User**: "What documents are in my workbooks?"

**LLM**:

- Calls\*\*:

1. `list_workbooks()` - Gets all workbooks
2. Returns formatted list of workbooks and documents

**Response**: Rendered markdown list showing all workbooks and their documents

### Example 2: Create Summary

**User**: "Create a summary of the NDA workbook as a markdown file"

**LLM Calls**:

1. `list_workbooks()` - Finds NDA workbook
2. `read_workbook_file()` - Reads relevant documents
3. `create_file_in_workbook()` - Creates `summary.md` with content

**Result**: New markdown file created in workbook with formatted summary

### Example 3: Create Table

**User**: "Create a table showing all documents in my workbooks"

**LLM Calls**:

1. `list_workbooks()` - Gets all workbooks
2. `create_file_in_workbook()` - Creates table as markdown

**Result**: Markdown file with formatted table:

```markdown
| Workbook | Document     | Added      |
| -------- | ------------ | ---------- |
| NDA      | contract.pdf | 2024-01-01 |
```

### Example 4: Answer Questions

**User**: "What are the key points in the contract.pdf file?"

**LLM Calls**:

1. `search_workbooks("contract.pdf")` - Finds file
2. `read_workbook_file()` - Reads file content
3. Analyzes and responds

**Response**: Formatted answer with key points, rendered as markdown

## How It Works

### 1. System Prompt

The LLM receives a system prompt explaining:

- Available tools
- How to use them
- Workbook structure
- When to create files

### 2. Tool Execution Flow

```
User Message
    ↓
LLM decides to use tool
    ↓
Tool executes (reads file, creates file, etc.)
    ↓
Tool result returned to LLM
    ↓
LLM provides final answer
```

### 3. Provider Support

**OpenAI**: Full function calling support

- Uses `tools` parameter
- Handles `tool_calls` in response
- Recursive tool calling

**Claude**: Tool use support

- Uses `tools` parameter
- Handles `tool_use` in response
- Recursive tool calling

**Ollama**: Prompt-based approach

- Parses JSON tool calls from response
- Executes tools
- Continues conversation

## Implementation Details

### Tool Definitions

Each tool has:

- `name`: Tool identifier
- `description`: What the tool does (helps LLM decide when to use it)
- `parameters`: JSON schema for arguments

### File Creation

When LLM creates a file:

1. File written to workbook documents folder
2. Workbook.json metadata updated
3. File appears in workbook tree immediately
4. Can be opened and viewed

### Markdown Rendering

- Chat uses `react-markdown` to render responses
- Tables, code blocks, lists all render properly
- Files created use standard markdown format

## Configuration

No additional configuration needed - tools are automatically available when LLM is configured.

## Limitations

1. **Ollama**: Uses prompt-based tool calling (less reliable than native function calling)
2. **File Size**: Large files may be truncated
3. **Context Window**: Limited by LLM provider's context window
4. **Streaming**: Not yet implemented (responses are complete)

## Future Enhancements

- Streaming responses
- Better error handling
- Tool call visualization
- More tools (edit files, move files, etc.)
- Vector search integration for better document understanding
