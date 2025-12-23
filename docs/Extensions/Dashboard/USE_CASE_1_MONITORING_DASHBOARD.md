# Use Case 1: Monitoring Dashboard MVP

## User Profile

**Generalist** (non-engineer) - Simple, straightforward interface needed.

## Workflow

1. **Create Workbooks** → Organize files (e.g., NDAs, supplier agreements)
2. **Add Files** → Drag & drop (Markdown, PDF, Word)
3. **Create Dashboard** → Ask questions like:
   - "How many NDAs do we have?"
   - "How many NDAs are expiring within 90 days?"
4. **LLM Can Write Files** → Ask LLM to create summaries/reports:
   - "Create a summary of all NDAs in the NDA workbook"
   - "Write a report of expiring agreements to `expiring_report.md`"
   - LLM writes markdown/text files to specified workbook
5. **Configure LLM** → Edit `llm.yaml` in file viewer (OpenAI, Claude, Local)

## Key Decisions ✅

- **Config**: YAML (`llm.yaml`) - keep current format
- **RAG Strategy**: Option B - LLM-driven file reading (on-demand)
- **Dashboard Search**: **REQUIRED** - Must support metadata + content search (key selling point)
- **Critical Rule**: Don't break existing markdown functionality

## File Format Support

**MVP Required**:

- ✅ Markdown (.md) - **DO NOT BREAK**
- 🔨 PDF (.pdf) - Add to current system first
- 🔨 Word (.docx) - Add to current system

**Post-MVP**: Excel, CSV

## Implementation Order

### Phase 1: File Reading (Priority)

1. Add PDF reading to current `read_workbook_file` tool
2. Add Word reading to current system
3. ⚠️ Ensure markdown continues working

### Phase 2: Dashboard Content Search

4. Enable dashboard to search document contents (not just metadata)
5. Support questions like "NDAs expiring in 90 days" (requires content parsing)

### Phase 3: Configuration

6. Allow opening `llm.yaml` in document viewer
7. Watch for changes and reload config

### Phase 4: RAG Integration (Later)

8. Integrate RAG carefully as helper tool
9. Maintain backward compatibility

## MVP Checklist

- [ ] PDF reading in current file system
- [ ] Word reading in current file system
- [ ] Dashboard content search (metadata + content)
- [ ] Config editing in viewer
- [ ] Markdown still works perfectly ✅
- [x] LLM file writing (already implemented ✅)

## Current State

**Already Working**:

- ✅ Workbooks, drag-drop, dashboard creation, markdown support, basic chat
- ✅ LLM file writing (`create_file_in_workbook` tool - writes markdown/text files)

**Needs Work**:

- 🔨 PDF/Word reading, content search, config editing
