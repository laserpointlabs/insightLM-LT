# MCP Server Extension Strategy

## Overview

This document outlines the strategy for converting MCP servers into extensions, determining which servers should remain as core services versus becoming extensions, and establishing a clear architecture for reusability across multiple projects.

## Core Principle

**Maximize Reusability**: MCP servers that provide reusable functionality should be bundled as extensions, making them portable across projects while maintaining clear boundaries between core services and feature extensions.

## Current MCP Servers Analysis

### Existing MCP Servers

```mermaid
graph TB
    subgraph "Current MCP Servers"
        Jupyter[Jupyter Server<br/>Python Execution]
        RAG[Workbook RAG<br/>Document Indexing & Search]
        Dashboard[Workbook Dashboard<br/>Dashboard Queries]
        Manager[Workbook Manager<br/>Workbook Management]
    end

    subgraph "Current Status"
        Status1[In mcp-servers/ directory]
        Status2[Tightly coupled to insightLM-LT]
        Status3[Not easily reusable]
    end

    Jupyter --> Status1
    RAG --> Status1
    Dashboard --> Status1
    Manager --> Status1

    Status1 --> Status2
    Status2 --> Status3

    style Jupyter fill:#FFD700
    style RAG fill:#FFD700
    style Dashboard fill:#FFD700
    style Manager fill:#FFD700
    style Status3 fill:#FFB6C1
```

## Categorization Strategy

### Core Services vs Extensions

```mermaid
graph TB
    subgraph "Core Services"
        Core1[Workbook Manager<br/>Foundation Service]
        Core2[Basic System Services<br/>Always Available]
    end

    subgraph "Base Extensions"
        Base1[RAG Extension<br/>Basic RAG - Included]
        Base2[Dashboards Extension<br/>UI Only - Included]
        Base3[Workbooks Extension<br/>UI Only - Included]
        Base4[Chat Extension<br/>UI Only - Included]
    end

    subgraph "Premium Extensions"
        Premium1[JupyterLab Extension<br/>Includes jupyter-server]
        Premium2[Advanced RAG Extension<br/>Enhanced RAG - Licensed]
        Premium3[MATLAB Extension<br/>Includes MATLAB server]
        Premium4[JD Edwards Extension<br/>Includes JD Edwards server]
    end

    style Core1 fill:#87CEEB
    style Core2 fill:#87CEEB
    style Base1 fill:#90EE90
    style Base2 fill:#90EE90
    style Base3 fill:#90EE90
    style Base4 fill:#90EE90
    style Premium1 fill:#FFD700
    style Premium2 fill:#FFD700
    style Premium3 fill:#FFD700
    style Premium4 fill:#FFD700
```

## Detailed Categorization

### Core Services (Not Extensions)

**Workbook Manager**
- **Purpose**: Foundational file and workbook management
- **Reason**: Core infrastructure, always needed
- **Status**: Stays as core service
- **Location**: `electron/services/workbookService.ts`

**Rationale**: This is the foundation of the application. Without it, nothing works. It's not a feature, it's infrastructure.

### Base Extensions (Always Enabled, No License)

#### 1. RAG Extension (Basic)

**Structure:**
```
rag-extension/
├── manifest.json
├── src/
│   └── (UI components if needed)
└── mcp-server/
    ├── server.py
    ├── config.json
    └── requirements.txt
```

**Features:**
- Basic document indexing
- Simple search and retrieval
- Standard embeddings
- Basic query processing

**MCP Server:**
- `rag-server` (basic)
- Handles document indexing
- Provides search/retrieval tools

**Why Extension:**
- Reusable across projects
- Can be upgraded to Advanced RAG
- Clear feature boundaries
- Portable to other tools

#### 2. Dashboards Extension

**Structure:**
```
dashboards-extension/
├── manifest.json
└── src/
    └── DashboardView.tsx
```

**Features:**
- Dashboard UI components
- Visualization components
- Dashboard management

**MCP Server:**
- None (uses existing RAG/LLM services)

**Why Extension:**
- UI-only extension
- Can be enhanced with premium features
- Clear separation from core

#### 3. Workbooks Extension

**Structure:**
```
workbooks-extension/
├── manifest.json
└── src/
    └── WorkbooksView.tsx
```

**Features:**
- Workbook UI components
- File management UI
- Workbook organization

**MCP Server:**
- None (uses core workbook service)

**Why Extension:**
- UI-only extension
- Can add premium workbook features
- Consistent with extension model

#### 4. Chat Extension

**Structure:**
```
chat-extension/
├── manifest.json
└── src/
    └── ChatView.tsx
```

**Features:**
- Chat UI components
- LLM integration UI
- Conversation management

**MCP Server:**
- None (uses LLM API directly)

**Why Extension:**
- UI-only extension
- Can add premium chat features
- Consistent architecture

### Premium Extensions (License Required)

#### 1. JupyterLab Extension

**Structure:**
```
jupyterlab-extension/
├── manifest.json
├── src/
│   ├── NotebookViewer.tsx
│   └── components/
└── mcp-server/
    ├── server.py
    ├── config.json
    └── requirements.txt
```

**Features:**
- Notebook UI (NotebookViewer)
- Python execution
- Cell management
- Rich output display

**MCP Server:**
- `jupyter-server`
- Python kernel execution
- Notebook file handling

**Status:** Currently being migrated

#### 2. Advanced RAG Extension

**Structure:**
```
advanced-rag-extension/
├── manifest.json
├── src/
│   └── (Advanced RAG UI if needed)
└── mcp-server/
    ├── server.py
    ├── config.json
    └── requirements.txt
```

**Features:**
- Advanced indexing strategies
- Multi-modal RAG
- Custom embeddings
- Advanced query processing
- Hybrid search
- Reranking

**MCP Server:**
- `advanced-rag-server`
- Enhanced RAG capabilities
- Can extend or replace basic RAG

**Upgrade Path:**
- Users with Basic RAG can upgrade
- Advanced RAG extends basic functionality
- Can run both (basic for simple, advanced for complex)

#### 3. MATLAB Extension

**Structure:**
```
matlab-extension/
├── manifest.json
├── src/
│   └── MATLABView.tsx
└── mcp-server/
    ├── server.m
    ├── config.json
    └── requirements.txt
```

**Features:**
- MATLAB script execution
- MATLAB file handling
- MATLAB-specific UI

**MCP Server:**
- `matlab-server`
- MATLAB execution engine

#### 4. JD Edwards Extension

**Structure:**
```
jd-edwards-extension/
├── manifest.json
├── src/
│   └── JDEdwardsView.tsx
└── mcp-server/
    ├── server.py
    ├── config.json
    └── requirements.txt
```

**Features:**
- JD Edwards integration
- ERP data access
- JD Edwards-specific UI

**MCP Server:**
- `jd-edwards-server`
- JD Edwards API integration

## Architecture Overview

### Complete Extension Architecture

```mermaid
graph TB
    subgraph "Core Application"
        Core[Core App<br/>Extension-Agnostic]
        CoreServices[Core Services<br/>- Workbook Manager<br/>- System Services]
    end

    subgraph "Base Extensions"
        RAGBase[RAG Extension<br/>Basic RAG Server]
        Dashboards[Dashboards Extension<br/>UI Only]
        Workbooks[Workbooks Extension<br/>UI Only]
        Chat[Chat Extension<br/>UI Only]
    end

    subgraph "Premium Extensions"
        Jupyter[JupyterLab Extension<br/>Jupyter Server]
        RAGAdvanced[Advanced RAG Extension<br/>Advanced RAG Server]
        MATLAB[MATLAB Extension<br/>MATLAB Server]
        JDE[JD Edwards Extension<br/>JD Edwards Server]
    end

    subgraph "Extension Registry"
        Registry[Registry Manager]
        MCPManager[MCP Service]
    end

    Core --> CoreServices
    Core --> Registry

    Registry --> RAGBase
    Registry --> Dashboards
    Registry --> Workbooks
    Registry --> Chat
    Registry --> Jupyter
    Registry --> RAGAdvanced
    Registry --> MATLAB
    Registry --> JDE

    RAGBase --> MCPManager
    Jupyter --> MCPManager
    RAGAdvanced --> MCPManager
    MATLAB --> MCPManager
    JDE --> MCPManager

    style Core fill:#87CEEB
    style CoreServices fill:#87CEEB
    style RAGBase fill:#90EE90
    style Dashboards fill:#90EE90
    style Workbooks fill:#90EE90
    style Chat fill:#90EE90
    style Jupyter fill:#FFD700
    style RAGAdvanced fill:#FFD700
    style MATLAB fill:#FFD700
    style JDE fill:#FFD700
    style Registry fill:#DDA0DD
    style MCPManager fill:#DDA0DD
```

## RAG Extension Strategy

### Basic vs Advanced RAG

```mermaid
graph LR
    subgraph "Basic RAG Extension"
        Basic[Basic RAG<br/>Always Enabled]
        BasicFeatures[Features:<br/>- Simple Indexing<br/>- Basic Search<br/>- Standard Embeddings]
        BasicServer[rag-server<br/>Basic MCP Server]
    end

    subgraph "Advanced RAG Extension"
        Advanced[Advanced RAG<br/>License Required]
        AdvancedFeatures[Features:<br/>- Advanced Indexing<br/>- Multi-modal<br/>- Custom Embeddings<br/>- Hybrid Search<br/>- Reranking]
        AdvancedServer[advanced-rag-server<br/>Advanced MCP Server]
    end

    Basic --> BasicFeatures
    BasicFeatures --> BasicServer

    Advanced --> AdvancedFeatures
    AdvancedFeatures --> AdvancedServer

    Basic -.Upgrade Path.-> Advanced

    style Basic fill:#90EE90
    style Advanced fill:#FFD700
    style BasicServer fill:#87CEEB
    style AdvancedServer fill:#87CEEB
```

### RAG Extension Interaction

```mermaid
sequenceDiagram
    participant User
    participant App
    participant BasicRAG as Basic RAG Extension
    participant AdvancedRAG as Advanced RAG Extension
    participant MCP as MCP Service

    User->>App: Simple Query
    App->>BasicRAG: Route to Basic RAG
    BasicRAG->>MCP: Call rag-server
    MCP->>BasicRAG: Basic Results
    BasicRAG->>App: Return Results
    App->>User: Display Results

    User->>App: Complex Query
    App->>AdvancedRAG: Route to Advanced RAG
    AdvancedRAG->>MCP: Call advanced-rag-server
    MCP->>AdvancedRAG: Advanced Results
    AdvancedRAG->>App: Return Results
    App->>User: Display Results

    Note over BasicRAG,AdvancedRAG: Both can run simultaneously<br/>App routes based on query complexity
```

## Migration Strategy

### Phase 1: Core Services Identification

**Tasks:**
- [ ] Identify truly foundational services
- [ ] Keep Workbook Manager as core service
- [ ] Document core vs extension criteria
- [ ] Establish core service boundaries

**Criteria for Core Services:**
- Required for application to function
- Not a feature, but infrastructure
- Cannot be disabled
- No alternative implementations

### Phase 2: RAG Extension Migration

**Tasks:**
- [ ] Create `rag-extension/` directory structure
- [ ] Move `mcp-servers/workbook-rag/` to `rag-extension/mcp-server/`
- [ ] Create RAG extension manifest
- [ ] Update Extension Registry to load RAG extension
- [ ] Test basic RAG functionality
- [ ] Verify RAG is portable/reusable

**Migration Path:**
```
mcp-servers/workbook-rag/
    ↓
extensions/rag-extension/
    ├── manifest.json
    └── mcp-server/
        └── (moved files)
```

### Phase 3: Dashboard Extension Migration

**Tasks:**
- [ ] Create `dashboards-extension/` directory
- [ ] Move dashboard UI components to extension
- [ ] Create dashboard extension manifest
- [ ] Update to use RAG extension for queries
- [ ] Test dashboard functionality

**Note:** Dashboard MCP server (`workbook-dashboard`) may be merged into RAG extension or become part of dashboard extension, depending on functionality.

### Phase 4: UI-Only Extensions

**Tasks:**
- [ ] Create `workbooks-extension/` for UI components
- [ ] Create `chat-extension/` for UI components
- [ ] Move UI components to respective extensions
- [ ] Update manifests
- [ ] Test all UI extensions

### Phase 5: Premium Extensions

**Tasks:**
- [ ] Complete JupyterLab extension (in progress)
- [ ] Plan Advanced RAG extension structure
- [ ] Design MATLAB extension (future)
- [ ] Design JD Edwards extension (future)

## Reusability Strategy

### Extension Portability

```mermaid
graph TB
    subgraph "Project A: insightLM-LT"
        ProjA[insightLM-LT]
        ExtA1[RAG Extension]
        ExtA2[JupyterLab Extension]
    end

    subgraph "Project B: Other Tool"
        ProjB[Other Tool]
        ExtB1[RAG Extension]
        ExtB2[Custom Extension]
    end

    subgraph "Shared Extensions"
        Shared[RAG Extension<br/>Reusable Package]
    end

    Shared --> ExtA1
    Shared --> ExtB1

    ExtA1 --> ProjA
    ExtA2 --> ProjA
    ExtB1 --> ProjB
    ExtB2 --> ProjB

    style Shared fill:#90EE90
    style ExtA1 fill:#87CEEB
    style ExtB1 fill:#87CEEB
```

### Distribution Methods

**Option 1: Git Submodules**
- Extension as separate git repository
- Projects include as submodule
- Version controlled

**Option 2: npm/pypi Packages**
- Publish extensions as packages
- Install via package manager
- Version managed by registry

**Option 3: Extension Registry**
- Central extension registry
- Install via `extension-manager install rag-extension`
- Handles dependencies and updates

**Recommended: Hybrid**
- Public extensions → npm/pypi
- Private extensions → Git submodules
- Development → Local paths

## Extension Dependencies

### Dependency Model

```mermaid
graph TB
    subgraph "Base Extensions"
        RAG[RAG Extension]
        Dashboards[Dashboards Extension]
    end

    subgraph "Premium Extensions"
        AdvancedRAG[Advanced RAG Extension]
        Jupyter[JupyterLab Extension]
    end

    Dashboards -.Uses.-> RAG
    AdvancedRAG -.Extends.-> RAG
    Jupyter -.Independent.-> RAG

    style RAG fill:#90EE90
    style Dashboards fill:#90EE90
    style AdvancedRAG fill:#FFD700
    style Jupyter fill:#FFD700
```

**Dependency Rules:**
- Extensions can depend on base extensions
- Premium extensions can extend base extensions
- Extensions cannot depend on premium extensions (to avoid licensing issues)
- Core services available to all extensions

## Implementation Roadmap

### Immediate (Current Sprint)

1. **JupyterLab Extension**
   - [ ] Complete MCP server bundling
   - [ ] Implement enable/disable
   - [ ] Move UI contributions

### Short Term (Next Sprint)

2. **RAG Extension**
   - [ ] Create extension structure
   - [ ] Move MCP server
   - [ ] Create manifest
   - [ ] Test portability

3. **Dashboard Extension**
   - [ ] Create extension structure
   - [ ] Move UI components
   - [ ] Integrate with RAG extension

### Medium Term (Future)

4. **UI-Only Extensions**
   - [ ] Workbooks extension
   - [ ] Chat extension
   - [ ] Complete base extension set

5. **Advanced RAG Extension**
   - [ ] Design advanced features
   - [ ] Create extension structure
   - [ ] Implement upgrade path

### Long Term (Future)

6. **Premium Extensions**
   - [ ] MATLAB extension
   - [ ] JD Edwards extension
   - [ ] Other domain-specific extensions

## Benefits Summary

### Reusability
✅ RAG extension portable to other projects
✅ JupyterLab extension reusable
✅ Clear extension boundaries
✅ Independent versioning

### Architecture
✅ Consistent extension model
✅ Clear core vs extension separation
✅ Scalable extension system
✅ Easy to add new extensions

### Commercial
✅ Clear licensing boundaries
✅ Upgrade paths (Basic → Advanced)
✅ Feature-based pricing
✅ Modular commercial model

### Development
✅ Independent development per extension
✅ Clear ownership
✅ Easier testing
✅ Better maintainability

## Questions for Discussion

1. **Dashboard MCP Server**
   - Should `workbook-dashboard` MCP server be part of Dashboard extension or RAG extension?
   - Or should it be merged into RAG extension?

2. **Advanced RAG Upgrade**
   - Should Advanced RAG replace Basic RAG or extend it?
   - Can both run simultaneously?

3. **Core Services**
   - Are there other services that should stay core?
   - Is Basic RAG too foundational to be an extension?

4. **Extension Dependencies**
   - How strict should dependency rules be?
   - Should extensions be able to depend on other extensions?

5. **Distribution**
   - Preferred distribution method for reusable extensions?
   - How to handle private/commercial extensions?

## Success Criteria

The MCP server extension strategy is successful when:

✅ All feature-specific MCP servers are bundled with extensions
✅ RAG extension is portable to other projects
✅ Core services are minimal and clearly defined
✅ Extension model is consistent across all extensions
✅ Enable/disable works for all extensions
✅ Extensions can be developed and distributed independently
✅ Clear upgrade paths exist (Basic → Advanced)

---

*Document Version: 1.0*
*Last Updated: 2025-01-15*









