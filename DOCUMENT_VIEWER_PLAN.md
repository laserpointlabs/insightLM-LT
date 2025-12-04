# Document Viewer Implementation Plan

## Current Status

### ✅ Working
- **Markdown** (.md) - Using `react-markdown`
- **CSV** (.csv) - Using `papaparse`, displays as table
- **Text files** (.txt, .js, .ts, .py, .json, .yaml, .xml, .html, .css) - Using Monaco Editor

### 🟡 Needs Implementation
- **PDF** (.pdf) - `react-pdf` installed but not implemented
- **DOCX** (.docx) - Not implemented
- **Images** (.png, .jpg, .jpeg, .gif, .svg, .webp, .bmp) - Not implemented
- **Excel** (.xlsx, .xls) - `xlsx` installed but not used
- **Other formats** - RTF, ODT, etc.

## Architecture Changes Needed

### 1. File Reading Strategy

**Current:** Files read as text strings via `file:read` IPC
**Problem:** Binary files (PDF, images, DOCX) can't be read as text

**Solution:** Two approaches:
- **Option A:** Return file path from Electron, load directly in renderer
- **Option B:** Return base64 encoded data for binary files
- **Option C:** Hybrid - text files as strings, binary files as base64 or paths

**Recommendation:** Option C (Hybrid)
- Text files: Keep current string-based approach
- Binary files: Return base64 or file:// path
- Add `file:readBinary` IPC handler for binary files

### 2. New IPC Handlers Needed

```typescript
// In electron/ipc/files.ts
ipcMain.handle("file:readBinary", async (_, workbookId: string, relativePath: string) => {
  // Return base64 encoded file or file:// path
});

ipcMain.handle("file:getPath", async (_, workbookId: string, relativePath: string) => {
  // Return absolute file system path for direct access
});
```

### 3. Viewer Components to Create

#### PDFViewer.tsx
- Use `react-pdf` library (already installed)
- Features: Page navigation, zoom, search
- Load from file path or base64

#### ImageViewer.tsx
- Simple image display
- Features: Zoom, pan, fit-to-screen
- Support: PNG, JPG, JPEG, GIF, SVG, WEBP, BMP

#### DOCXViewer.tsx
- Options:
  - `mammoth` - Converts DOCX to HTML
  - `docx-preview` - React component for DOCX
  - `docx` + custom renderer
- Recommendation: `mammoth` (lightweight, converts to HTML)

#### ExcelViewer.tsx
- Use `xlsx` library (already installed)
- Display as table with sheets/tabs
- Features: Sheet navigation, cell formatting

#### RTFViewer.tsx (optional)
- Convert RTF to HTML or plain text
- Library: `rtf-parser` or similar

### 4. File Type Detection

Create a utility to map file extensions to viewers:

```typescript
// src/utils/fileTypeUtils.ts
export type FileType = 'markdown' | 'csv' | 'pdf' | 'image' | 'docx' | 'excel' | 'text' | 'unknown';

export function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const typeMap: Record<string, FileType> = {
    // Text
    'md': 'markdown',
    'markdown': 'markdown',
    'csv': 'csv',
    'txt': 'text',
    'js': 'text',
    'ts': 'text',
    'json': 'text',
    'yaml': 'text',
    'yml': 'text',
    'xml': 'text',
    'html': 'text',
    'css': 'text',

    // Documents
    'pdf': 'pdf',
    'docx': 'docx',
    'doc': 'docx', // Legacy Word format
    'xlsx': 'excel',
    'xls': 'excel',

    // Images
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    'bmp': 'image',
  };

  return typeMap[ext] || 'unknown';
}
```

### 5. Updated DocumentViewer Component

```typescript
// Enhanced routing logic
const renderDocument = () => {
  const fileType = getFileType(activeDoc.filename);

  switch (fileType) {
    case 'markdown':
      return <MarkdownViewer content={activeDoc.content || ""} />;
    case 'csv':
      return <CSVViewer content={activeDoc.content || ""} />;
    case 'pdf':
      return <PDFViewer workbookId={activeDoc.workbookId} path={activeDoc.path} />;
    case 'image':
      return <ImageViewer workbookId={activeDoc.workbookId} path={activeDoc.path} />;
    case 'docx':
      return <DOCXViewer workbookId={activeDoc.workbookId} path={activeDoc.path} />;
    case 'excel':
      return <ExcelViewer workbookId={activeDoc.workbookId} path={activeDoc.path} />;
    case 'text':
      return <TextViewer content={activeDoc.content || ""} filename={activeDoc.filename} />;
    default:
      return <UnknownFileViewer filename={activeDoc.filename} />;
  }
};
```

## Implementation Order

### Phase 1: Binary File Support (Foundation)
1. Add `file:readBinary` IPC handler
2. Add `file:getPath` IPC handler
3. Update FileService to handle binary files
4. Update documentStore to handle binary content

### Phase 2: Image Viewer (Easiest)
1. Create ImageViewer component
2. Add image file type detection
3. Test with various image formats

### Phase 3: PDF Viewer
1. Implement PDFViewer with react-pdf
2. Add page navigation controls
3. Add zoom controls
4. Handle loading states and errors

### Phase 4: DOCX Viewer
1. Install `mammoth` library
2. Create DOCXViewer component
3. Convert DOCX to HTML and render
4. Handle formatting preservation

### Phase 5: Excel Viewer
1. Create ExcelViewer component
2. Use xlsx to parse and display
3. Add sheet/tab navigation
4. Format cells appropriately

### Phase 6: Polish
1. Add loading states for all viewers
2. Add error handling
3. Add "unsupported file type" fallback
4. Optimize performance for large files

## Dependencies Needed

```json
{
  "mammoth": "^1.6.0",  // DOCX to HTML conversion
  // react-pdf already installed
  // xlsx already installed
}
```

## File Size Considerations

- **Large PDFs:** Implement lazy loading, virtual scrolling for pages
- **Large Images:** Add image optimization, lazy loading
- **Large Excel files:** Paginate rows, virtual scrolling
- **Large DOCX:** Stream conversion if possible

## Security Considerations

- Validate file types before rendering
- Sanitize HTML output from DOCX conversion
- Limit file size for security (optional)
- Handle malicious file types gracefully





