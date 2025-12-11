# JupyterLab Extension for Insight LM-LT

This extension provides Jupyter notebook functionality within the Insight LM-LT application.

## Features

- **Notebook Creation**: Create new Jupyter notebooks directly from the workbooks view
- **Notebook Viewer**: View and edit `.ipynb` files with syntax highlighting
- **Cell Execution**: Execute Python code cells via MCP server integration
- **Output Display**: Display execution results, errors, and visualizations
- **Extension Framework**: Built on the extensible plugin architecture

## Architecture

### Components

1. **Extension Manifest** (`manifest.ts`): Defines the extension's capabilities and contributions
2. **Notebook Viewer** (`NotebookViewer.tsx`): React component for displaying and editing notebooks
3. **MCP Server** (`../../../mcp-servers/jupyter-server/`): Backend server for kernel management and code execution

### Extension Points Used

- **File Handlers**: Registers `.ipynb` file type support
- **Commands**: Provides notebook creation command
- **Context Providers**: Supplies notebook execution results to LLM context
- **Notebook Providers**: Manages notebook creation and cell execution

## MCP Server

The Jupyter MCP server provides:

- **execute_cell**: Execute Python code in Jupyter kernels
- **create_notebook**: Create new notebook files
- **list_kernels**: List available Jupyter kernels

## Usage

1. **Create Notebook**: Click the notebook icon in the workbooks view
2. **Edit Cells**: Click "Edit" on any code cell to modify the source
3. **Execute Cells**: Click "Run" to execute code via the MCP server
4. **View Results**: Execution outputs appear below each cell

## Dependencies

- `jupyter-client`: For kernel management
- `nbformat`: For notebook format handling
- `ipykernel`: Python kernel support

## Future Enhancements

- Multiple kernel support (R, Julia)
- Rich output rendering (plots, images)
- Notebook sharing and collaboration
- RAG integration for notebook content indexing
- LLM-powered notebook assistance
