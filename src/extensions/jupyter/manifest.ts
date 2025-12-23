import { ExtensionManifest } from '../../types';
import { NotebookIcon } from './NotebookIcon';
import { createNotebook } from './actions/createNotebook';

export const jupyterExtensionManifest: ExtensionManifest = {
  id: 'jupyter-extension',
  name: 'JupyterLab Extension',
  version: '0.1.0',
  description: 'Embedded JupyterLab functionality for notebooks and Python execution',
  author: 'Insight LM-LT',
  activationEvents: ['onFileOpen:.ipynb'],
  mcpServer: {
    name: 'jupyter-server',
    description: 'Jupyter notebook execution server',
    command: 'python',
    args: ['server.py'],
    env: {
      INSIGHTLM_DATA_DIR: ''
    },
    serverPath: 'mcp-servers/jupyter-server'
  },
  contributes: {
    fileHandlers: [{
      extensions: ['ipynb'],
      component: () => import('./NotebookViewer').then(m => m.NotebookViewer),
      priority: 10
    }],
    commands: [{
      id: 'jupyter.create-notebook',
      title: 'Create New Notebook',
      handler: async (workbookId: string) => {
        // This will be implemented when we create the notebook creation functionality
        console.log('Creating notebook for workbook:', workbookId);
      }
    }],
    contextProviders: [{
      id: 'notebook-results',
      name: 'Notebook Results',
      provider: async () => {
        // This will provide context from recent notebook executions
        return ['Notebook context will be provided here'];
      }
    }],
    notebookProviders: [{
      id: 'python-kernel',
      name: 'Python Kernel',
      kernels: ['python3'],
      createNotebook: async (path: string) => {
        // Notebook creation is handled by the calling component
        // This function defines the interface for future expansion
        console.log('Notebook creation interface called for:', path);
      },
      executeCell: async (notebookPath: string, cellIndex: number, code: string) => {
        // This will execute code via the Jupyter MCP server
        // For now, return a placeholder result
        return {
          output_type: 'stream',
          name: 'stdout',
          text: 'Code execution not yet implemented\n'
        };
      }
    }],
    workbookActions: [{
      id: 'jupyter.create-notebook',
      title: 'Create New Notebook',
      icon: NotebookIcon,
      onClick: createNotebook
    }]
  }
};
