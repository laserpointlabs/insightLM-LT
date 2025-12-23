#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

class SimpleElectronMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'simple-electron-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.processes = new Map();
  }

  setupToolHandlers() {
    // Launch Electron app with debugging
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'launch_electron_app':
          return this.launchElectronApp(args);

        case 'close_electron_app':
          return this.closeElectronApp(args);

        case 'list_electron_processes':
          return this.listProcesses();

        case 'get_debug_info':
          return this.getDebugInfo(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // List available tools
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'launch_electron_app',
            description: 'Launch an Electron application with debugging enabled',
            inputSchema: {
              type: 'object',
              properties: {
                appPath: {
                  type: 'string',
                  description: 'Path to the Electron application main file or directory'
                },
                debugPort: {
                  type: 'number',
                  description: 'Port for Chrome DevTools Protocol (default: 9222)',
                  default: 9222
                },
                args: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Additional arguments to pass to the Electron app'
                }
              },
              required: ['appPath']
            }
          },
          {
            name: 'close_electron_app',
            description: 'Close a running Electron application',
            inputSchema: {
              type: 'object',
              properties: {
                processId: {
                  type: 'number',
                  description: 'Process ID of the Electron app to close'
                }
              },
              required: ['processId']
            }
          },
          {
            name: 'list_electron_processes',
            description: 'List all running Electron processes',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_debug_info',
            description: 'Get debugging information for an Electron process',
            inputSchema: {
              type: 'object',
              properties: {
                processId: {
                  type: 'number',
                  description: 'Process ID of the Electron app'
                }
              },
              required: ['processId']
            }
          }
        ]
      };
    });
  }

  async launchElectronApp(args) {
    const { appPath, debugPort = 9222, args: appArgs = [] } = args;

    // Check if path exists
    if (!fs.existsSync(appPath)) {
      throw new Error(`Electron app path does not exist: ${appPath}`);
    }

    // Determine if it's a directory with package.json or a direct JS file
    const isDirectory = fs.statSync(appPath).isDirectory();
    const mainPath = isDirectory ? path.join(appPath, 'main.js') : appPath;

    if (isDirectory && !fs.existsSync(mainPath)) {
      throw new Error(`Could not find main.js in directory: ${appPath}`);
    }

    // Launch with debugging enabled
    const electronArgs = [
      '--remote-debugging-port=' + debugPort,
      '--enable-logging',
      mainPath,
      ...appArgs
    ];

    console.error(`Launching Electron app: ${mainPath} with debug port ${debugPort}`);

    const process = spawn('electron', electronArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: isDirectory ? appPath : path.dirname(appPath)
    });

    const processId = process.pid;
    this.processes.set(processId, {
      process,
      appPath,
      debugPort,
      startTime: Date.now()
    });

    // Handle process output
    process.stdout.on('data', (data) => {
      console.error(`[${processId}] stdout: ${data}`);
    });

    process.stderr.on('data', (data) => {
      console.error(`[${processId}] stderr: ${data}`);
    });

    process.on('exit', (code) => {
      console.error(`[${processId}] exited with code ${code}`);
      this.processes.delete(processId);
    });

    return {
      content: [
        {
          type: 'text',
          text: `Successfully launched Electron app (PID: ${processId}) with debugging enabled on port ${debugPort}`
        }
      ]
    };
  }

  async closeElectronApp(args) {
    const { processId } = args;
    const processInfo = this.processes.get(processId);

    if (!processInfo) {
      throw new Error(`No Electron process found with PID: ${processId}`);
    }

    processInfo.process.kill('SIGTERM');

    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Force kill if still running
    if (!processInfo.process.killed) {
      processInfo.process.kill('SIGKILL');
    }

    this.processes.delete(processId);

    return {
      content: [
        {
          type: 'text',
          text: `Closed Electron app with PID: ${processId}`
        }
      ]
    };
  }

  async listProcesses() {
    const processes = Array.from(this.processes.entries()).map(([pid, info]) => ({
      pid,
      appPath: info.appPath,
      debugPort: info.debugPort,
      uptime: Math.floor((Date.now() - info.startTime) / 1000)
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Running Electron processes:\n${JSON.stringify(processes, null, 2)}`
        }
      ]
    };
  }

  async getDebugInfo(args) {
    const { processId } = args;
    const processInfo = this.processes.get(processId);

    if (!processInfo) {
      throw new Error(`No Electron process found with PID: ${processId}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Debug info for PID ${processId}:\n${JSON.stringify({
            appPath: processInfo.appPath,
            debugPort: processInfo.debugPort,
            debugUrl: `http://localhost:${processInfo.debugPort}`,
            uptime: Math.floor((Date.now() - processInfo.startTime) / 1000),
            chromeDevToolsUrl: `chrome://devtools/inspector.html?ws=localhost:${processInfo.debugPort}`
          }, null, 2)}`
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Simple Electron MCP Server started');
  }
}

// Run the server
const server = new SimpleElectronMCPServer();
server.run().catch(console.error);










