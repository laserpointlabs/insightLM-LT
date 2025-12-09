# MCP Server Migration Plan: Upgrading to FastMCP

## Overview

This document outlines the plan to migrate all existing MCP servers from raw JSON-RPC implementation to FastMCP framework for better maintainability, type safety, and standardization.

## Current State Analysis

### Server Inventory

| Server | Status | Protocol | Tools/Methods | Complexity |
|--------|--------|----------|---------------|------------|
| **workbook-rag** | ✅ Active | Custom (no init) | `rag/search`, `rag/search_content`, `rag/read_file`, `rag/list_files`, `rag/health` | High |
| **workbook-dashboard** | ✅ Active | JSON-RPC (with init) | `create_dashboard_query`, `format_llm_response` | Medium |
| **workbook-manager** | ⚠️ Placeholder | Custom | `workbook/create`, `workbook/list` | Low |
| **document-parser** | ⚠️ Placeholder | Custom | `parse/pdf`, `parse/docx` | Low |

### Current Issues

1. **Inconsistent Protocol**: workbook-rag doesn't send initialization message
2. **Manual JSON-RPC**: All servers manually handle JSON-RPC protocol
3. **No Type Safety**: No input validation or type checking
4. **Error Handling**: Inconsistent error handling across servers
5. **Boilerplate**: Lots of repetitive code for protocol handling

### Benefits of Migration

- ✅ **Less Code**: ~70% reduction in boilerplate
- ✅ **Type Safety**: Python type hints for automatic validation
- ✅ **Consistency**: All servers follow same pattern
- ✅ **Maintainability**: Easier to understand and modify
- ✅ **Error Handling**: Built-in error handling
- ✅ **Documentation**: Auto-generated from docstrings

---

## Migration Strategy

### Phase 1: Setup & Preparation (Week 1)

**Goals:**
- Install FastMCP dependency
- Create migration branch
- Set up testing infrastructure
- Document current behavior

**Tasks:**
1. ✅ Add `mcp>=1.0.0` to all `requirements.txt` files
2. ✅ Create `migration-fastmcp` branch
3. ✅ Document current API contracts (what each tool/method does)
4. ✅ Create test suite for each server (if not exists)
5. ✅ Set up CI/CD to run tests

**Deliverables:**
- Updated requirements.txt files
- API contract documentation
- Test suite baseline

---

### Phase 2: Migrate workbook-dashboard (Week 1-2)

**Priority: Medium** (Already has proper JSON-RPC, easier migration)

**Current State:**
- ✅ Proper JSON-RPC initialization
- ✅ Two tools: `create_dashboard_query`, `format_llm_response`
- ✅ Well-structured handler functions

**Migration Steps:**

1. **Install FastMCP**
   ```bash
   cd mcp-servers/workbook-dashboard
   pip install mcp>=1.0.0
   ```

2. **Update server.py**
   - Replace manual JSON-RPC with FastMCP
   - Convert tool definitions to `@mcp.tool()` decorators
   - Keep existing handler functions (minimal changes)

3. **Test**
   - Run existing tests
   - Test from Electron app
   - Verify dashboard queries still work

**Expected Changes:**
```python
# Before: ~100 lines of protocol handling
# After: ~30 lines with FastMCP

from mcp import FastMCP

mcp = FastMCP("workbook-dashboard")

@mcp.tool()
def create_dashboard_query(question: str, tileType: str) -> dict:
    """Creates a structured LLM request for a dashboard tile"""
    # Existing handler logic
    return handle_dashboard_query({"question": question, "tileType": tileType})

@mcp.tool()
def format_llm_response(llmResponse: str, expectedSchema: dict, tileType: str) -> dict:
    """Formats an LLM response for visualization"""
    # Existing handler logic
    return handle_format_response({
        "llmResponse": llmResponse,
        "expectedSchema": expectedSchema,
        "tileType": tileType
    })

if __name__ == "__main__":
    mcp.run()
```

**Risk Level:** Low
**Estimated Time:** 2-4 hours

---

### Phase 3: Migrate workbook-rag (Week 2-3)

**Priority: High** (Most complex, most used)

**Current State:**
- ⚠️ Custom protocol (no initialization message)
- ⚠️ Uses methods instead of tools (`rag/search`, `rag/search_content`, etc.)
- ✅ Well-structured business logic
- ✅ Complex file reading/searching logic

**Migration Steps:**

1. **Add Initialization**
   - FastMCP requires proper initialization
   - Convert methods to tools
   - Map existing method names to tool names

2. **Update server.py**
   - Wrap existing functions with `@mcp.tool()` decorators
   - Convert method-based calls to tool-based calls
   - Keep all business logic unchanged

3. **Update Electron Integration**
   - Update `MCPService` if needed (should work as-is)
   - Update any direct method calls to use `tools/call`

4. **Test Thoroughly**
   - Test all search operations
   - Test file reading
   - Test from LLM Service
   - Verify RAG functionality still works

**Expected Changes:**
```python
# Before: Custom protocol, no init
# After: FastMCP with proper tools

from mcp import FastMCP

mcp = FastMCP("workbook-rag")

@mcp.tool()
def search(query: str, limit: int = 20) -> dict:
    """Search for files across workbooks by filename"""
    results = search_workbooks(query, limit)
    return {"result": results}

@mcp.tool()
def search_content(query: str, limit: int = 5) -> dict:
    """Search document CONTENT across all workbooks"""
    results = search_workbooks_with_content(query, limit)
    return {"result": {"content": results}}

@mcp.tool()
def read_file(workbook_id: str, file_path: str) -> dict:
    """Read a specific file from a workbook"""
    content = read_workbook_file(workbook_id, file_path)
    return {"result": {"content": content}}

@mcp.tool()
def list_files() -> dict:
    """List all files in all workbooks"""
    files = list_all_files()
    return {"result": files}

if __name__ == "__main__":
    mcp.run()
```

**Backward Compatibility:**
- May need to update LLM Service tool names
- Update from `rag/search` to `search` (or keep alias)

**Risk Level:** Medium (complex server, widely used)
**Estimated Time:** 4-8 hours

---

### Phase 4: Migrate workbook-manager (Week 3)

**Priority: Low** (Placeholder, not actively used)

**Current State:**
- ⚠️ Placeholder implementation
- ⚠️ Minimal functionality
- ⚠️ Not integrated with app

**Migration Steps:**

1. **Implement Proper Tools**
   - Define actual workbook CRUD operations
   - Use FastMCP from start
   - Follow patterns from other servers

2. **Test**
   - Basic CRUD operations
   - Integration with Electron app

**Expected Changes:**
```python
from mcp import FastMCP
from pathlib import Path

mcp = FastMCP("workbook-manager")

@mcp.tool()
def create_workbook(name: str) -> dict:
    """Create a new workbook"""
    # Implementation
    pass

@mcp.tool()
def list_workbooks() -> dict:
    """List all workbooks"""
    # Implementation
    pass

if __name__ == "__main__":
    mcp.run()
```

**Risk Level:** Low
**Estimated Time:** 2-4 hours

---

### Phase 5: Migrate document-parser (Week 3)

**Priority: Low** (Placeholder, not actively used)

**Current State:**
- ⚠️ Placeholder implementation
- ⚠️ Minimal functionality

**Migration Steps:**

1. **Implement Proper Tools**
   - PDF parsing
   - DOCX parsing
   - Other formats as needed

2. **Test**
   - Parse various file types
   - Verify extraction quality

**Expected Changes:**
```python
from mcp import FastMCP

mcp = FastMCP("document-parser")

@mcp.tool()
def parse_pdf(file_path: str) -> dict:
    """Extract text from PDF"""
    # Implementation
    pass

@mcp.tool()
def parse_docx(file_path: str) -> dict:
    """Extract text from DOCX"""
    # Implementation
    pass

if __name__ == "__main__":
    mcp.run()
```

**Risk Level:** Low
**Estimated Time:** 2-4 hours

---

## Migration Checklist

### For Each Server

- [ ] **Preparation**
  - [ ] Add `mcp>=1.0.0` to `requirements.txt`
  - [ ] Document current API contract
  - [ ] Create test baseline

- [ ] **Migration**
  - [ ] Install FastMCP: `pip install mcp`
  - [ ] Replace manual JSON-RPC with FastMCP
  - [ ] Convert methods/tools to `@mcp.tool()` decorators
  - [ ] Add type hints to tool functions
  - [ ] Update docstrings
  - [ ] Remove manual protocol handling code

- [ ] **Testing**
  - [ ] Run unit tests
  - [ ] Test from Electron app
  - [ ] Test from LLM Service
  - [ ] Verify all functionality works
  - [ ] Check error handling

- [ ] **Integration**
  - [ ] Update Electron `MCPService` if needed
  - [ ] Update LLM Service tool names if changed
  - [ ] Update documentation
  - [ ] Update README.md

- [ ] **Cleanup**
  - [ ] Remove old code
  - [ ] Remove unused imports
  - [ ] Update comments
  - [ ] Commit changes

---

## Testing Strategy

### Unit Tests

For each server, test:
- Tool registration (initialization)
- Tool execution (happy path)
- Error handling (invalid inputs)
- Edge cases (empty results, missing files, etc.)

### Integration Tests

- Test from Electron app (`MCPService.sendRequest`)
- Test from LLM Service (tool calling)
- Test end-to-end workflows

### Regression Tests

- Verify existing functionality still works
- Check performance (should be same or better)
- Verify error messages are clear

---

## Rollback Plan

If migration causes issues:

1. **Keep old code**: Don't delete until migration is verified
2. **Feature flag**: Use `config.json` to enable/disable FastMCP version
3. **Gradual rollout**: Migrate one server at a time
4. **Quick revert**: Git branch makes rollback easy

**Rollback Steps:**
```bash
# Revert to previous version
git checkout main -- mcp-servers/workbook-rag/server.py

# Or use feature flag in config.json
{
  "use_fastmcp": false  # Fall back to old implementation
}
```

---

## Timeline

| Phase | Server | Duration | Risk | Priority |
|-------|--------|----------|------|----------|
| 1 | Setup | 1 week | Low | High |
| 2 | workbook-dashboard | 2-4 hours | Low | Medium |
| 3 | workbook-rag | 4-8 hours | Medium | High |
| 4 | workbook-manager | 2-4 hours | Low | Low |
| 5 | document-parser | 2-4 hours | Low | Low |

**Total Estimated Time:** 1-2 weeks (including testing and integration)

---

## Success Criteria

Migration is successful when:

- ✅ All servers use FastMCP
- ✅ All existing functionality works
- ✅ Code is cleaner and more maintainable
- ✅ Type safety is improved
- ✅ Error handling is consistent
- ✅ Tests pass
- ✅ Documentation is updated

---

## Example: workbook-dashboard Migration

### Before (Raw JSON-RPC)

```python
def main():
    tools = [
        {
            "name": "create_dashboard_query",
            "description": "...",
            "inputSchema": {...}
        }
    ]

    init_response = {
        "jsonrpc": "2.0",
        "id": 1,
        "result": {
            "protocolVersion": "0.1.0",
            "serverInfo": {"name": "workbook-dashboard", "version": "2.0.0"},
            "capabilities": {"tools": tools}
        }
    }
    print(json.dumps(init_response), flush=True)

    for line in sys.stdin:
        request = json.loads(line)
        if request.get("method") == "tools/call":
            # ... handle request ...
```

### After (FastMCP)

```python
from mcp import FastMCP

mcp = FastMCP("workbook-dashboard")

@mcp.tool()
def create_dashboard_query(question: str, tileType: str) -> dict:
    """
    Creates a structured LLM request for a dashboard tile.

    Args:
        question: The question to ask (e.g., 'What is the main gear MOS?')
        tileType: Type of visualization tile (counter, graph, table, etc.)

    Returns:
        Dictionary with system prompt and expected schema
    """
    return handle_dashboard_query({"question": question, "tileType": tileType})

@mcp.tool()
def format_llm_response(llmResponse: str, expectedSchema: dict, tileType: str) -> dict:
    """
    Formats an LLM response for visualization based on expected format.

    Args:
        llmResponse: The raw LLM response text
        expectedSchema: Expected JSON schema of the response
        tileType: Type of tile (for additional formatting)

    Returns:
        Formatted result dictionary
    """
    return handle_format_response({
        "llmResponse": llmResponse,
        "expectedSchema": expectedSchema,
        "tileType": tileType
    })

if __name__ == "__main__":
    mcp.run()
```

**Code Reduction:** ~70% less boilerplate

---

## Next Steps

1. **Review this plan** with team
2. **Create migration branch**: `git checkout -b migration-fastmcp`
3. **Start with Phase 1**: Setup and preparation
4. **Migrate workbook-dashboard first** (easiest, lowest risk)
5. **Test thoroughly** before moving to next server
6. **Document any issues** encountered
7. **Update this plan** based on learnings

---

## Questions & Concerns

**Q: Will this break existing functionality?**
A: No, we'll test thoroughly and migrate one server at a time. Old code stays until verified.

**Q: Do we need to update Electron app?**
A: Minimal changes. `MCPService` should work as-is since FastMCP uses same JSON-RPC protocol.

**Q: What about performance?**
A: FastMCP is just a wrapper - performance should be same or better.

**Q: Can we migrate incrementally?**
A: Yes! Migrate one server at a time, test, then move to next.

**Q: What if FastMCP doesn't support something we need?**
A: FastMCP is flexible - we can extend it or fall back to raw implementation if needed.

---

## Resources

- **FastMCP Docs**: https://github.com/modelcontextprotocol/python-sdk
- **MCP Protocol Spec**: https://modelcontextprotocol.io
- **Migration Examples**: See `docs/MCP_SERVER_FRAMEWORKS.md`
- **Current Servers**: `mcp-servers/*/server.py`

---

**Status**: 📋 Planning
**Last Updated**: 2024-01-XX
**Owner**: Development Team








