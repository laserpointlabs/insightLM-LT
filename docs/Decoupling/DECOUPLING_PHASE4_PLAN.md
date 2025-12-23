# Phase 4: Decouple Dashboard Formatting

## Goal
Make dashboard MCP server format-agnostic by separating formatting from LLM prompt creation.

## Current Problem
Dashboard MCP server creates LLM-specific prompts, tightly coupling it to LLM internals.

## Solution
- Move prompt creation to a separate `DashboardPromptService`
- Make dashboard MCP server a pure formatter that doesn't know about LLM internals
- Dashboard MCP only handles `format_llm_response` tool

## Implementation Plan

### 1. Create DashboardPromptService
- Extract all prompt creation logic from MCP server
- Create format-agnostic prompts with current date injection
- Support all tile types: counter, counter_warning, graph, table, text, date, color

### 2. Refactor Dashboard MCP Server
- Remove `create_dashboard_query` tool
- Keep only `format_llm_response` tool
- Remove system prompt schemas (only keep validation schemas)
- Make it purely a formatter

### 3. Update DashboardQueryService
- Use `DashboardPromptService` instead of MCP server for prompt creation
- Continue using MCP server only for formatting
- Update constructor to accept `DashboardPromptService`

### 4. Update Main Process
- Initialize `DashboardPromptService`
- Pass to `DashboardQueryService` constructor

### 5. Add Tests
- Test `DashboardPromptService` independently
- Test dashboard MCP format-agnostic behavior
- Test decoupled dashboard flow
- Update comprehensive test suite

## Success Criteria
- [ ] Dashboard MCP server only provides `format_llm_response` tool
- [ ] Dashboard MCP server has no knowledge of LLM prompts
- [ ] `DashboardPromptService` can create prompts independently
- [ ] Dashboard queries work end-to-end with decoupled architecture
- [ ] All Phase 4 tests pass
- [ ] No hardcoded references to prompt creation in MCP server

## Benefits
- Dashboard MCP server is now format-agnostic
- Prompt creation logic is reusable and testable
- Clear separation of concerns between formatting and prompting
- Easier to maintain and extend dashboard functionality