# Univer Extension - Migration Plan

## Executive Summary

**Goal:** Create a new Univer-based spreadsheet extension alongside the existing Luckysheet extension, providing:
- Modern, actively maintained spreadsheet engine
- Native chart/graph support (no complex Vue/Vuex setup)
- Better performance and architecture
- Full LLM integration with contextual awareness
- Dashboard integration for charts

**Key Principle:** Keep existing Luckysheet extension intact - users can choose which to use.

## Why Univer?

### Advantages over Luckysheet

1. **Actively Maintained**: Luckysheet is no longer maintained; Univer is actively developed
2. **Native Charts**: Built-in chart support without complex dependencies (no Vue/Vuex/Element-UI)
3. **Better Architecture**: Modern React/TypeScript architecture, better performance
4. **AI-Native**: Univer Platform supports natural language-driven spreadsheets
5. **Formula Engine**: Fast formula engine that can run in Web Workers or server-side
6. **Collaboration**: Built-in collaborative editing support
7. **Extensibility**: Plugin architecture for custom features

### Comparison

| Feature | Luckysheet | Univer |
|---------|-----------|--------|
| Maintenance | ❌ No longer maintained | ✅ Actively maintained |
| Charts | ⚠️ Requires ChartMix (Vue/Vuex) | ✅ Native support |
| Performance | ⚠️ Can be slow with large sheets | ✅ Optimized rendering |
| Architecture | ⚠️ jQuery-based, older patterns | ✅ Modern React/TypeScript |
| Formula Engine | ⚠️ Client-side only | ✅ Web Workers + Server-side |
| AI Integration | ❌ None | ✅ Univer Platform (natural language) |
| Collaboration | ❌ None | ✅ Built-in |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │      Univer Spreadsheet Extension (NEW)          │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │   Univer React Component                   │  │  │
│  │  │   - Grid display                            │  │  │
│  │  │   - Cell editing                            │  │  │
│  │  │   - Formula bar                             │  │  │
│  │  │   - Charts (native)                         │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │           ↕ IPC (Electron API)                     │  │
│  └──────────────────────────────────────────────────┘  │
│                    ↕                                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Univer Platform (Optional)                    │  │
│  │   - Natural language → spreadsheet operations   │  │
│  │   - AI-driven formula generation                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                    ↕
         ┌──────────────────┐
         │  Workbook Storage │
         │  (.is documents)  │
         │  (same format!)   │
         └──────────────────┘
                    ↕
         ┌──────────────────┐
         │   RAG Indexing    │
         │  (Context-aware)  │
         └──────────────────┘
                    ↕
         ┌──────────────────┐
         │  Dashboard Export │
         │  (Charts as tiles)│
         └──────────────────┘
```

## File Structure

```
src/extensions/univer-spreadsheet/          # NEW extension
├── manifest.ts                            # Extension manifest
├── UniverSpreadsheetViewer.tsx            # Main viewer component
├── components/
│   ├── UniverGrid.tsx                     # Univer grid wrapper
│   ├── ChartExport.tsx                    # Chart export to dashboard
│   └── FormulaBar.tsx                     # Formula input bar
├── hooks/
│   ├── useUniverSpreadsheet.ts            # Spreadsheet state management
│   ├── useChartExport.ts                  # Chart export hook
│   └── useLLMIntegration.ts               # LLM context integration
├── actions/
│   └── createUniverSpreadsheet.ts         # Create new spreadsheet
├── utils/
│   ├── formatConverter.ts                 # Convert .is format to Univer format
│   └── chartExporter.ts                   # Export charts to dashboard format
└── types.ts                                # TypeScript types

# Keep existing extension intact:
src/extensions/spreadsheet/                # EXISTING (Luckysheet)
└── ... (unchanged)
```

## Key Design Decisions

### 1. Same File Format (.is)

**Decision:** Use the same `.is` file format as Luckysheet extension.

**Rationale:**
- Users can switch between extensions seamlessly
- RAG indexing works the same way
- No migration needed for existing files
- Format converter handles differences internally

**Implementation:**
- Converter functions: `.is` → Univer format (on load)
- Converter functions: Univer format → `.is` (on save)
- Both extensions can read/write the same files

### 2. Separate Extension ID

**Decision:** New extension ID: `univer-spreadsheet-extension`

**Rationale:**
- Users can enable/disable independently
- Both can coexist
- Different file handler priorities (Univer can be higher priority)

**Implementation:**
```typescript
export const univerSpreadsheetExtensionManifest: ExtensionManifest = {
  id: 'univer-spreadsheet-extension',
  name: 'Univer Spreadsheet Extension',
  // ...
  contributes: {
    fileHandlers: [{
      extensions: ['is'],
      component: () => import('./UniverSpreadsheetViewer').then(m => m.UniverSpreadsheetViewer),
      priority: 20  // Higher than Luckysheet (10) - Univer opens by default
    }],
    // ...
  }
};
```

### 3. Chart Integration

**Decision:** Charts are first-class citizens in Univer.

**Features:**
- Charts as separate sheets (like Excel)
- Charts embedded in cells
- Export charts to dashboard tiles
- Charts visible in RAG context

**Implementation:**
- Univer's native chart API
- Chart data extracted for RAG indexing
- Dashboard export via `useChartExport` hook
- Chart metadata stored in `.is` format

### 4. LLM Integration

**Decision:** Enhanced LLM awareness with Univer Platform.

**Features:**
- Natural language → spreadsheet operations
- Formula generation from descriptions
- Data analysis queries
- Chart creation from natural language

**Implementation:**
- Univer Platform API (optional, can use basic Univer)
- RAG indexing includes chart data
- LLM tools for spreadsheet operations
- Context-aware formula suggestions

## Implementation Plan

### Phase 1: Foundation (Week 1)

- [ ] Install Univer packages (`@univerjs/core`, `@univerjs/sheets`, `@univerjs/ui`)
- [ ] Create extension structure (`src/extensions/univer-spreadsheet/`)
- [ ] Create manifest (`manifest.ts`)
- [ ] Register extension in `App.tsx`
- [ ] Create basic `UniverSpreadsheetViewer` component
- [ ] Set up file handler for `.is` files
- [ ] Create format converter (`.is` ↔ Univer format)
- [ ] Basic grid display and cell editing

### Phase 2: Core Features (Week 2)

- [ ] Formula support (Univer's built-in engine)
- [ ] Cell formatting (number, date, text formats)
- [ ] Conditional formatting
- [ ] Save/load `.is` files
- [ ] Integration with existing file system
- [ ] RAG indexing integration (reuse existing logic)

### Phase 3: Charts (Week 3)

- [ ] Chart creation UI
- [ ] Chart types (bar, line, pie, scatter, etc.)
- [ ] Charts as separate sheets
- [ ] Chart data extraction for RAG
- [ ] Chart export to dashboard format
- [ ] Chart metadata in `.is` format

### Phase 4: LLM Integration (Week 4)

- [ ] Natural language → spreadsheet operations
- [ ] Formula generation from descriptions
- [ ] Data analysis queries
- [ ] Chart creation from natural language
- [ ] Enhanced RAG context (charts included)
- [ ] LLM tools for spreadsheet operations

### Phase 5: Dashboard Integration (Week 5)

- [ ] Export charts as dashboard tiles
- [ ] Link spreadsheet data to dashboards
- [ ] Real-time updates from spreadsheets
- [ ] Dashboard queries spreadsheet data

## Technical Details

### Univer Installation

```bash
npm install @univerjs/core @univerjs/sheets @univerjs/ui @univerjs/icons
```

### Basic Component Structure

```typescript
import { Univer } from '@univerjs/core';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';

export function UniverSpreadsheetViewer({ content, filename, workbookId, onContentChange }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerInstanceRef = useRef<Univer | null>(null);

  useEffect(() => {
    // Initialize Univer
    const univer = new Univer({
      // Configuration
    });

    // Add plugins
    univer.registerPlugin(UniverSheetsPlugin);
    univer.registerPlugin(UniverSheetsUIPlugin);

    // Create workbook from .is format
    const workbookData = convertIsToUniverFormat(content);
    univer.createUnit(workbookData);

    univerInstanceRef.current = univer;

    return () => {
      univer.dispose();
    };
  }, [content]);

  return <div ref={containerRef} id="univer-container" />;
}
```

### Format Converter

```typescript
// Convert .is format to Univer format
function convertIsToUniverFormat(isData: SpreadsheetData): UniverWorkbookData {
  return {
    id: 'workbook-1',
    name: isData.metadata.name,
    sheets: isData.sheets.map(sheet => ({
      id: sheet.id,
      name: sheet.name,
      cellData: convertCellsToUniverFormat(sheet.cells),
      // ... other properties
    })),
  };
}

// Convert Univer format back to .is format
function convertUniverToIsFormat(univerData: UniverWorkbookData): SpreadsheetData {
  // Extract data from Univer and convert to .is format
}
```

### Chart Export to Dashboard

```typescript
function useChartExport() {
  const exportChartToDashboard = useCallback((chartId: string, chartData: any) => {
    // Convert Univer chart to dashboard tile format
    const tileData = {
      type: 'chart',
      chartType: chartData.type,
      data: chartData.data,
      // ... other properties
    };

    // Create dashboard tile via IPC
    window.electronAPI.dashboard.createTile(workbookId, tileData);
  }, []);

  return { exportChartToDashboard };
}
```

## Migration Strategy

### For Users

1. **Both Extensions Available**: Users can choose which to use
2. **File Compatibility**: Both read/write `.is` format
3. **Gradual Migration**: Users can migrate files one at a time
4. **Default to Univer**: New files open with Univer (higher priority)

### For Developers

1. **Keep Luckysheet Extension**: Don't break existing functionality
2. **Share Utilities**: Common utilities (format converters, RAG indexing) can be shared
3. **Feature Parity**: Univer extension should support all Luckysheet features
4. **Testing**: Test both extensions with same `.is` files

## Benefits

1. **Modern Architecture**: React/TypeScript, better performance
2. **Native Charts**: No complex dependencies
3. **AI Integration**: Univer Platform for natural language
4. **Active Maintenance**: Regularly updated, bug fixes
5. **Better UX**: Faster, more responsive
6. **Dashboard Integration**: Charts can be exported to dashboards
7. **Future-Proof**: Built for modern web standards

## Risks & Mitigation

### Risk 1: Breaking Existing Functionality
**Mitigation:** Keep Luckysheet extension intact, create separate extension

### Risk 2: Format Compatibility Issues
**Mitigation:** Thorough testing of format converters, handle edge cases

### Risk 3: Learning Curve
**Mitigation:** Good documentation, gradual rollout, user choice

### Risk 4: Performance Issues
**Mitigation:** Univer is optimized for performance, test with large files

## Next Steps

1. Review and approve this plan
2. Install Univer packages
3. Create extension structure
4. Implement basic viewer
5. Test format conversion
6. Iterate based on feedback

## References

- [Univer GitHub](https://github.com/dream-num/univer)
- [Univer Documentation](https://docs.univer.ai)
- [Univer Examples](https://docs.univer.ai/showcase)
