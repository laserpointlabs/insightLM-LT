# MCP Servers

Pluggable MCP (Model Context Protocol) servers for insightLM-LT.

## Adding a New MCP Server

1. Create a new folder in `mcp-servers/`
2. Add `config.json` with server metadata:
   ```json
   {
     "name": "server-name",
     "description": "Server description",
     "command": "python",
     "args": ["server.py"],
     "enabled": true
   }
   ```
3. Add `server.py` implementing the MCP protocol
4. Add `requirements.txt` for Python dependencies
5. Restart the app to discover the new server

## Built-in Servers

- **workbook-manager**: Workbook CRUD operations
- **workbook-rag**: Vector search with LanceDB
- **document-parser**: PDF/DOCX parsing
