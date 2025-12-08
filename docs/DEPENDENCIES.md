# Dependencies and Capabilities

This document tracks key dependencies and their purposes in the build.

## Core Dependencies

### UI Framework
- **react** (^18.2.0) - React UI framework
- **react-dom** (^18.2.0) - React DOM rendering
- **tailwindcss** (^3.4.0) - CSS framework for styling
- **@tailwindcss/typography** (^0.5.19) - Tailwind typography plugin for prose styling
  - **Purpose**: Provides `prose` class for beautiful markdown rendering
  - **Usage**: Used in `MarkdownViewer.tsx` for markdown preview styling
  - **Configuration**: Added to `tailwind.config.js` plugins array
  - **Added**: 2024
- **autoprefixer** (^10.4.16) - CSS vendor prefixing
- **postcss** (^8.4.32) - CSS processing

### Electron
- **electron** (^28.0.0) - Desktop application framework
- **electron-updater** (^6.6.2) - Auto-update functionality
- **chokidar** (^3.5.3) - File system watching

### State Management
- **zustand** (^4.4.7) - Lightweight state management

### Document Viewing & Editing

#### Markdown
- **react-markdown** (^9.0.1) - Markdown rendering
- **remark-gfm** (^4.0.1) - GitHub Flavored Markdown support for react-markdown
  - **Purpose**: Enables tables, task lists, strikethrough, and other GFM features
  - **Usage**: Used in `MarkdownViewer.tsx` as a remark plugin
  - **Configuration**: Added to ReactMarkdown remarkPlugins array
  - **Added**: 2024
- **mermaid** (^11.12.1) - Mermaid diagram rendering in markdown
  - **Purpose**: Renders Mermaid diagrams (flowcharts, sequence diagrams, etc.) within markdown code blocks
  - **Usage**: Used in `MarkdownViewer.tsx` to detect and render `\`\`\`mermaid` code blocks
  - **Implementation**: Custom MermaidDiagram component with single initialization and async rendering
  - **Added**: 2024
- **remark-mermaid** (^0.2.0) - Mermaid plugin for remark (installed but using custom implementation instead)
  - **Status**: Installed for future use
  - **Added**: 2024

#### Code Editing
- **@monaco-editor/react** (^4.6.0) - Monaco Editor (VS Code editor) for code editing
  - **Purpose**: Provides syntax highlighting and editing for text-based files
  - **Supported languages**: JavaScript, TypeScript, Python, PowerShell, JSON, YAML, SQL, and many more

#### CSV
- **papaparse** (^5.4.1) - CSV parsing and generation
  - **Purpose**: Parse CSV files for table display and editing

#### PDF
- **react-pdf** (^7.6.0) - PDF rendering
  - **Purpose**: Renders PDF files with page navigation and zoom controls
  - **Usage**: Used in `PDFViewer.tsx` to display PDF documents
  - **Features**: Page navigation, zoom in/out, text layer rendering
  - **Implementation**: Uses `file:getPath` IPC handler to get absolute file path
  - **Added**: 2024

#### Excel
- **xlsx** (^0.18.5) - Excel file parsing
  - **Status**: Installed but not yet fully implemented

### Data Processing
- **js-yaml** (^4.1.0) - YAML parsing for configuration files
- **uuid** (^9.0.1) - UUID generation

## Dev Dependencies

- **typescript** (^5.3.3) - TypeScript compiler
- **vite** (^5.0.8) - Build tool and dev server
- **@vitejs/plugin-react** (^4.2.1) - Vite React plugin
- **electron-builder** (^24.9.1) - Electron app packaging
- **concurrently** (^8.2.2) - Run multiple npm scripts concurrently
- **kill-port** (^2.0.1) - Utility to kill processes on specific ports
  - **Purpose**: Cleans up Vite dev server ports before starting dev mode
  - **Usage**: Automatically runs via `predev` script to kill ports 5173-5180
  - **Scripts**: `npm run clean` to manually kill ports
  - **Added**: 2024
- **@types/\*** - TypeScript type definitions

## Adding New Capabilities

When adding a new capability that requires a new dependency:

1. **Install the dependency**: `npm install <package-name>`
2. **Update this file**: Add the dependency to the appropriate section with:
   - Package name and version
   - Purpose/description
   - Where it's used
   - Date added
3. **Update IMPLEMENTATION_STATUS.md**: Add the feature to the appropriate section
4. **Update README.md**: If it's a user-facing feature, mention it in the features list

## Build Process

The build process includes all dependencies automatically via `npm install`. No additional configuration needed for standard npm packages.
