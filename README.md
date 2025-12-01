# insightLM-LT

A lightweight desktop application for workbook management and AI chat.

## Features

- **Workbook Management**: Create, rename, delete, and archive workbooks
- **Document Management**: Add, view, rename, delete, and move documents
- **Archive System**: Archive workbooks and files for later access
- **AI Chat**: Chat with your documents using OpenAI, Claude, or Ollama
- **Document Viewers**: View markdown, CSV, PDF, and text files
- **Drag and Drop**: Easily add files by dragging from Windows Explorer
- **MCP Server Support**: Pluggable MCP servers for extensibility
- **Simple UI**: Clean, intuitive interface with minimal clicks

## Development

### Prerequisites

- Node.js 20+
- Python 3.8+ (for MCP servers)
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Install Python dependencies for MCP servers
cd mcp-servers/workbook-manager && pip install -r requirements.txt
cd ../workbook-rag && pip install -r requirements.txt
cd ../document-parser && pip install -r requirements.txt
cd ../..

# Run in development mode
npm run dev
```

### Configuration

1. **LLM Provider**: Edit `config/llm.yaml` to set your LLM provider and API key

   ```yaml
   provider: "openai" # or "claude" or "ollama"
   apiKey: "${OPENAI_API_KEY}" # Use environment variable
   model: "gpt-4"
   ```

2. **App Settings**: Edit `config/app.yaml` if needed
   ```yaml
   dataDir: "%APPDATA%/insightLM-LT"
   llmProvider: "openai"
   ```

### Build

```bash
# Build for production
npm run build
```

The built application will be in the `out/` directory.

## Project Structure

- `electron/` - Electron main process files
  - `main.ts` - Main process entry point
  - `ipc/` - IPC handlers for communication
  - `services/` - Backend services (workbook, file, archive, config, MCP, LLM)
- `src/` - React application source code
  - `components/` - UI components
  - `store/` - Zustand state management
  - `services/` - Frontend services
- `config/` - Configuration files (YAML)
- `mcp-servers/` - Pluggable MCP server implementations

## Usage

1. **Create a Workbook**: Right-click in the sidebar → "New Workbook"
2. **Add Documents**: Drag files from Windows Explorer onto a workbook, or right-click workbook → "Add File"
3. **View Documents**: Click a document in the workbook tree to open it
4. **Chat**: Type questions in the chat panel to interact with your documents
5. **Archive**: Right-click workbook or file → "Archive" to archive it

## MCP Servers

MCP servers are automatically discovered on startup. To add a new server:

1. Create a folder in `mcp-servers/`
2. Add `config.json` with server metadata
3. Add `server.py` implementing the MCP protocol
4. Add `requirements.txt` for dependencies
5. Restart the app

See `mcp-servers/README.md` for details.

## Notes

- This is a lite version focused on simplicity
- All configuration is via YAML files (no admin UI)
- MCP servers run locally as subprocesses
- Data is stored in `%APPDATA%/insightLM-LT/`
