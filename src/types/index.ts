export interface Workbook {
  id: string;
  name: string;
  created: string;
  updated: string;
  archived: boolean;
  documents: Document[];
}

export interface Document {
  filename: string;
  path: string;
  addedAt: string;
  archived?: boolean;
}

export interface WorkbookMetadata {
  id: string;
  name: string;
  created: string;
  updated: string;
  archived?: boolean;
  documents: Array<{
    filename: string;
    path: string;
    addedAt: string;
  }>;
}

// Extension/Plugin System Types
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  activationEvents?: string[];
  mcpServer?: McpServerContribution;
  contributes?: {
    views?: ViewContribution[];
    commands?: CommandContribution[];
    fileHandlers?: FileHandlerContribution[];
    contextProviders?: ContextProviderContribution[];
    notebookProviders?: NotebookProviderContribution[];
    workbookActions?: WorkbookActionContribution[];
  };
}

export interface ViewContribution {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  workbenchIds?: string[];
}

export interface CommandContribution {
  id: string;
  title: string;
  handler: (...args: any[]) => any;
  workbenchIds?: string[];
}

export interface FileHandlerContribution {
  extensions: string[];
  component: React.ComponentType<any>;
  priority?: number;
}

export interface ContextProviderContribution {
  id: string;
  name: string;
  provider: () => Promise<string[]>;
}

export interface NotebookProviderContribution {
  id: string;
  name: string;
  kernels: string[];
  createNotebook: (path: string) => Promise<void>;
  executeCell: (notebookPath: string, cellIndex: number, code: string) => Promise<any>;
}

export interface WorkbookActionContribution {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (workbookId: string) => Promise<void> | void;
}

export interface McpServerContribution {
  name: string;
  description?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  /**
   * Path to the server directory (where server.py/config.json live).
   * Can be relative to process.cwd() or absolute.
   */
  serverPath: string;
}

// Notebook Types
export interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string;
  outputs?: NotebookOutput[];
  execution_count?: number | null;
  metadata?: any;
}

export interface NotebookOutput {
  output_type: 'stream' | 'display_data' | 'execute_result' | 'error';
  name?: string;
  text?: string;
  data?: { [key: string]: any };
  traceback?: string[];
  execution_count?: number;
}

export interface NotebookDocument {
  cells: NotebookCell[];
  metadata: {
    kernelspec?: {
      name: string;
      display_name: string;
      language: string;
    };
    language_info?: any;
  };
  nbformat: number;
  nbformat_minor: number;
}
