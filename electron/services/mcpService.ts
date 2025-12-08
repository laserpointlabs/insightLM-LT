import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";

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
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class MCPService {
  private servers: Map<string, ChildProcess> = new Map();
  private serversDir: string;
  private requestQueues: Map<string, QueuedRequest[]> = new Map();
  private responseBuffers: Map<string, string> = new Map();

  constructor(serversDir: string) {
    this.serversDir = serversDir;
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
          // Get the next pending request for this server
          const queue = this.requestQueues.get(config.name);
          if (queue && queue.length > 0) {
            const queuedRequest = queue.shift()!;
            if (response.error) {
              queuedRequest.reject(new Error(response.error));
            } else {
              queuedRequest.resolve(response.result || response);
            }
            // Process next request in queue
            this.processNextRequest(config.name);
          } else {
            // No pending request, treat as log
            console.log(`[MCP ${config.name}] ${trimmed}`);
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
    });

    this.servers.set(config.name, proc);
  }

  stopServer(name: string): void {
    const proc = this.servers.get(name);
    if (proc) {
      proc.kill();
      this.servers.delete(name);
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

    return new Promise((resolve, reject) => {
      const queue = this.requestQueues.get(serverName)!;

      // Set timeout
      const timeoutId = setTimeout(() => {
        const index = queue.findIndex(q => q.resolve === resolve);
        if (index >= 0) {
          queue.splice(index, 1);
        }
        reject(new Error(`MCP request to ${serverName} timed out after ${timeout}ms`));
      }, timeout);

      // Add to queue with request data
      const queuedRequest: QueuedRequest = {
        method,
        params,
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
      method: request.method,
      params: request.params,
    };

    try {
      proc.stdin?.write(JSON.stringify(mcpRequest) + '\n');
    } catch (error) {
      const failedRequest = queue.shift()!;
      failedRequest.reject(error);
      // Try next request
      this.processNextRequest(serverName);
    }
  }
}
