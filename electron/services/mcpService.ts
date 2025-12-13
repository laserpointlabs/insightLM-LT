import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import { ToolDefinition } from "./llmService";

export interface MCPServerConfig {
  name: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

interface QueuedRequest {
  method: string;
  params: Record<string, any>;
  id: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export type ToolDiscoveryCallback = (serverName: string, tools: ToolDefinition[]) => void;
export type ServerStopCallback = (serverName: string) => void;

export class MCPService {
  private servers: Map<string, ChildProcess> = new Map();
  private serversDir: string;
  private requestQueues: Map<string, QueuedRequest[]> = new Map();
  private responseBuffers: Map<string, string> = new Map();
  private toolDiscoveryCallback?: ToolDiscoveryCallback;
  private serverStopCallback?: ServerStopCallback;
  private serverInitialized: Map<string, boolean> = new Map();
  private extensionManagedServers: Set<string> = new Set();
  private nextRequestId: Map<string, number> = new Map();

  constructor(serversDir: string) {
    this.serversDir = serversDir;
  }

  /**
   * Mark a server as managed by an extension (should not auto-start)
   */
  markExtensionManaged(serverName: string): void {
    this.extensionManagedServers.add(serverName);
  }

  /**
   * Check if a server is managed by an extension
   */
  isExtensionManaged(serverName: string): boolean {
    return this.extensionManagedServers.has(serverName);
  }

  /**
   * Get all running server names
   */
  getRunningServers(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * Check if a server is running
   */
  isServerRunning(serverName: string): boolean {
    const proc = this.servers.get(serverName);
    return proc !== undefined && !proc.killed;
  }

  /**
   * Set callback for when tools are discovered from MCP servers
   */
  setToolDiscoveryCallback(callback: ToolDiscoveryCallback): void {
    this.toolDiscoveryCallback = callback;
  }

  setServerStopCallback(callback: ServerStopCallback): void {
    this.serverStopCallback = callback;
  }

  discoverServers(): MCPServerConfig[] {
    const configs: MCPServerConfig[] = [];

    if (!fs.existsSync(this.serversDir)) {
      return configs;
    }

    const entries = fs.readdirSync(this.serversDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const serverPath = path.join(this.serversDir, entry.name);
      const configPath = path.join(serverPath, "config.json");

      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, "utf-8");
          const config = JSON.parse(content) as MCPServerConfig;
          console.log(`[MCP Discovery] Found server: ${config.name}, enabled: ${config.enabled}`);
          configs.push(config);
        } catch (error) {
          console.error(
            `Failed to load MCP server config ${entry.name}:`,
            error,
          );
        }
      }
    }

    return configs;
  }

  startServer(config: MCPServerConfig, serverPath: string): void {
    console.log(`[MCP] Starting server: ${config.name}, enabled: ${config.enabled}`);

    if (this.servers.has(config.name)) {
      console.warn(`Server ${config.name} is already running`);
      return;
    }

    // Check if command is a system executable (like python, python3, node)
    // or a relative/absolute path
    let fullCommandPath: string;
    if (path.isAbsolute(config.command)) {
      // Absolute path - use as is
      fullCommandPath = config.command;
    } else if (config.command.includes(path.sep) || config.command.includes("/") || config.command.includes("\\") || config.command.startsWith(".")) {
      // Relative path - join with serverPath
      fullCommandPath = path.join(serverPath, config.command);
    } else {
      // System command (python, python3, node, etc.) - use as is
      // spawn will find it in PATH
      fullCommandPath = config.command;
    }

    const args = config.args.map((arg) =>
      arg === "server.py" ? path.join(serverPath, "server.py") : arg,
    );

    // Expand environment variables in config.env if present
    const expandedEnv: Record<string, string> = {};
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        // Expand ${VAR} syntax
        expandedEnv[key] = value.replace(/\$\{(\w+)\}/g, (match, varName) => {
          return process.env[varName] || match;
        });
      }
    }

    const env = {
      ...process.env,
      ...expandedEnv,
    };

    const proc = spawn(fullCommandPath, args, {
      cwd: serverPath,
      env,
      stdio: "pipe",
      shell: process.platform === "win32", // Use shell on Windows to find python in PATH
    });

    // Capture stdout and stderr for debugging
    let stdout = "";
    let stderr = "";
    let buffer = "";

    // Handle stdout - parse JSON responses
    // MCP servers respond sequentially (no request IDs)
    let responseBuffer = "";
    proc.stdout?.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      responseBuffer += text;

      // Try to parse complete JSON lines
      const lines = responseBuffer.split('\n');
      responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const response = JSON.parse(trimmed);
          
          // Check if this is an initialization message with tool definitions
          if (response.result?.capabilities?.tools && !this.serverInitialized.get(config.name)) {
            const hasTools = this.handleServerInitialization(config.name, response);
            // Only mark as initialized if tools were found in initialization
            // Otherwise, discoverTools will handle it via tools/list
            if (hasTools) {
              this.serverInitialized.set(config.name, true);
            }
            // Continue to process as normal response if there's a queue
          }
          
          // Match response to request by ID
          const queue = this.requestQueues.get(config.name);
          if (queue && queue.length > 0) {
            const responseId = response.id;
            const requestIndex = queue.findIndex(q => q.id === responseId);
            
            if (requestIndex >= 0) {
              const queuedRequest = queue.splice(requestIndex, 1)[0];
              console.log(`[MCP ${config.name}] Received response for request ${responseId}:`, JSON.stringify(response).substring(0, 200));
              
              if (response.error) {
                const errorMsg = typeof response.error === 'string' 
                  ? response.error 
                  : response.error.message || JSON.stringify(response.error);
                queuedRequest.reject(new Error(errorMsg));
              } else {
                queuedRequest.resolve(response.result || response);
              }
              // Process next request in queue
              this.processNextRequest(config.name);
            } else {
              // Response ID doesn't match any queued request - might be unsolicited response
              console.warn(`[MCP ${config.name}] Received response with ID ${responseId} but no matching request found`);
              // Still process next request in case queue got out of sync
              if (queue.length > 0) {
                this.processNextRequest(config.name);
              }
            }
          } else {
            // No pending request, treat as log or initialization message
            if (response.result?.capabilities) {
              // This is an initialization message, already handled above
              console.log(`[MCP ${config.name}] Initialization message`);
            } else {
              console.log(`[MCP ${config.name}] ${trimmed}`);
            }
          }
        } catch (e) {
          // Not JSON, treat as log
          console.log(`[MCP ${config.name}] ${trimmed}`);
        }
      }
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
      console.error(`[MCP ${config.name} ERROR] ${data.toString().trim()}`);
    });

    proc.on("error", (error) => {
      console.error(`MCP server ${config.name} spawn error:`, error);
      console.error(`Command: ${fullCommandPath} ${args.join(" ")}`);
      console.error(`Working directory: ${serverPath}`);
      console.error(`STDERR: ${stderr}`);
      this.servers.delete(config.name);
      // Notify that server stopped (due to error)
      if (this.serverStopCallback) {
        this.serverStopCallback(config.name);
      }
    });

    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`MCP server ${config.name} exited with code ${code}`);
        console.error(`STDOUT: ${stdout}`);
        console.error(`STDERR: ${stderr}`);
      } else {
        console.log(`MCP server ${config.name} exited normally`);
      }
      this.servers.delete(config.name);
      this.serverInitialized.delete(config.name);
      // Notify that server stopped
      if (this.serverStopCallback) {
        this.serverStopCallback(config.name);
      }
    });

    this.servers.set(config.name, proc);
    
    // After server starts, wait a bit then try to discover tools
    setTimeout(() => {
      this.discoverTools(config.name).catch(err => {
        console.warn(`[MCP] Failed to discover tools from ${config.name}:`, err);
      });
    }, 1000); // Give server 1 second to initialize
  }

  /**
   * Handle server initialization message that may contain tool definitions
   * Returns true if tools were found and registered, false otherwise
   */
  private handleServerInitialization(serverName: string, initResponse: any): boolean {
    const capabilities = initResponse.result?.capabilities;
    if (capabilities?.tools) {
      // Some servers send tools in initialization (like workbook-dashboard)
      // Others just indicate they support tools/list (like workbook-rag with listChanged: true)
      const tools = Array.isArray(capabilities.tools) 
        ? capabilities.tools 
        : capabilities.tools.list || [];
      
      if (tools.length > 0) {
        const toolDefinitions = this.convertMCPToolsToDefinitions(serverName, tools);
        if (this.toolDiscoveryCallback) {
          this.toolDiscoveryCallback(serverName, toolDefinitions);
        }
        return true; // Tools found in initialization
      }
    }
    return false; // No tools in initialization, will use tools/list
  }

  /**
   * Discover tools from an MCP server by calling tools/list
   */
  private async discoverTools(serverName: string): Promise<void> {
    // Check if we already have tools for this server
    // If server sent tools in initialization, we might already have them
    // But we should still try tools/list if server indicates listChanged support
    
    try {
      console.log(`[MCP] Discovering tools from ${serverName}...`);
      
      // Try to get tools via tools/list
      const response = await this.sendRequest(serverName, "tools/list", {}, 5000);
      
      if (response?.tools && Array.isArray(response.tools)) {
        const toolDefinitions = this.convertMCPToolsToDefinitions(serverName, response.tools);
        console.log(`[MCP] Discovered ${toolDefinitions.length} tools from ${serverName}`);
        
        if (this.toolDiscoveryCallback && toolDefinitions.length > 0) {
          this.toolDiscoveryCallback(serverName, toolDefinitions);
        }
        // Mark as initialized after successful discovery
        this.serverInitialized.set(serverName, true);
      } else {
        console.log(`[MCP] ${serverName} does not support tools/list or returned no tools`);
      }
    } catch (error) {
      // Server may not support tools/list - that's okay
      console.log(`[MCP] ${serverName} does not support tools/list: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert MCP tool format to ToolDefinition format
   */
  private convertMCPToolsToDefinitions(serverName: string, mcpTools: any[]): ToolDefinition[] {
    return mcpTools.map(tool => {
      // MCP tools use inputSchema, LLM tools use parameters
      const inputSchema = tool.inputSchema || {};
      
      return {
        name: tool.name,
        description: tool.description || `Tool from ${serverName}`,
        parameters: {
          type: inputSchema.type || "object",
          properties: inputSchema.properties || {},
          required: inputSchema.required || [],
        },
      };
    });
  }

  stopServer(name: string): void {
    const proc = this.servers.get(name);
    if (proc) {
      console.log(`[MCP] Stopping server: ${name}`);
      proc.kill();
      this.servers.delete(name);
      this.serverInitialized.delete(name);
      // Clear request queue
      this.requestQueues.delete(name);
      this.nextRequestId.delete(name);
      // Notify that server stopped
      if (this.serverStopCallback) {
        console.log(`[MCP] Calling serverStopCallback for ${name}`);
        this.serverStopCallback(name);
      } else {
        console.warn(`[MCP] No serverStopCallback set, tools will not be unregistered for ${name}`);
      }
    } else {
      console.warn(`[MCP] Server ${name} not found in running servers, but unregistering tools anyway`);
      // Even if server isn't running, we should unregister tools
      if (this.serverStopCallback) {
        this.serverStopCallback(name);
      }
    }
  }

  stopAll(): void {
    for (const [name] of this.servers) {
      this.stopServer(name);
    }
  }

  /**
   * Send a request to an MCP server and wait for response
   * Servers respond sequentially, so we use a queue
   */
  async sendRequest(serverName: string, method: string, params: Record<string, any>, timeout: number = 30000): Promise<any> {
    const proc = this.servers.get(serverName);
    if (!proc || proc.killed) {
      throw new Error(`MCP server ${serverName} is not running`);
    }

    // Initialize queue if needed
    if (!this.requestQueues.has(serverName)) {
      this.requestQueues.set(serverName, []);
    }

    // Get next request ID for this server
    if (!this.nextRequestId.has(serverName)) {
      this.nextRequestId.set(serverName, 1);
    }
    const requestId = this.nextRequestId.get(serverName)!;
    this.nextRequestId.set(serverName, requestId + 1);

    return new Promise((resolve, reject) => {
      const queue = this.requestQueues.get(serverName)!;

      // Set timeout
      const timeoutId = setTimeout(() => {
        const index = queue.findIndex(q => q.id === requestId);
        if (index >= 0) {
          queue.splice(index, 1);
        }
        reject(new Error(`MCP request to ${serverName} timed out after ${timeout}ms`));
      }, timeout);

      // Add to queue with request data
      const queuedRequest: QueuedRequest = {
        method,
        params,
        id: requestId,
        resolve: (response: any) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      };

      queue.push(queuedRequest);

      // Send request if this is the first in queue
      if (queue.length === 1) {
        this.processNextRequest(serverName);
      }
    });
  }

  /**
   * Process the next request in queue for a server
   */
  private processNextRequest(serverName: string): void {
    const proc = this.servers.get(serverName);
    const queue = this.requestQueues.get(serverName);

    if (!proc || !queue || queue.length === 0 || proc.killed) {
      return;
    }

    const request = queue[0];
    const mcpRequest = {
      jsonrpc: "2.0",
      id: request.id,
      method: request.method,
      params: request.params,
    };

    try {
      const requestJson = JSON.stringify(mcpRequest) + '\n';
      console.log(`[MCP ${serverName}] Sending request:`, JSON.stringify(mcpRequest));
      proc.stdin?.write(requestJson);
    } catch (error) {
      const failedRequest = queue.shift()!;
      failedRequest.reject(error);
      // Try next request
      this.processNextRequest(serverName);
    }
  }
}
