import { ExtensionManifest } from '../../types';
import { SpreadsheetIcon } from './SpreadsheetIcon';
import { createSpreadsheet } from './actions/createSpreadsheet';

export const spreadsheetExtensionManifest: ExtensionManifest = {
  id: 'spreadsheet-extension',
  name: 'Insight Sheet Extension',
  version: '0.1.0',
  description: 'Excel-like spreadsheet functionality with Python-driven formula calculation',
  author: 'Insight LM-LT',
  activationEvents: ['onFileOpen:.is'],
  mcpServer: {
    name: 'spreadsheet-server',
    description: 'Spreadsheet formula calculation server',
    command: 'python',
    args: ['server.py'],
    env: {
      INSIGHTLM_DATA_DIR: ''
    },
    serverPath: 'mcp-servers/spreadsheet-server'
  },
  contributes: {
    fileHandlers: [{
      extensions: ['is'],
      component: () => import('./SpreadsheetViewer').then(m => m.SpreadsheetViewer),
      priority: 10
    }],
    commands: [{
      id: 'spreadsheet.create-sheet',
      title: 'Create New Insight Sheet',
      handler: async (workbookId: string) => {
        console.log('Creating spreadsheet for workbook:', workbookId);
        return createSpreadsheet(workbookId);
      }
    }],
    contextProviders: [{
      id: 'spreadsheet-data',
      name: 'Spreadsheet Data',
      provider: async () => {
        // This will provide context from spreadsheets (with formulas visible!)
        return ['Spreadsheet context will be provided here'];
      }
    }],
    workbookActions: [{
      id: 'spreadsheet.create-sheet',
      title: 'Create New Insight Sheet',
      icon: SpreadsheetIcon,
      onClick: createSpreadsheet
    }]
  }
};
