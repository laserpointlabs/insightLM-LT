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

export class MCPService {
  private servers: Map<string, ChildProcess> = new Map();
  private serversDir: string;

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

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
      console.log(`[MCP ${config.name}] ${data.toString().trim()}`);
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
}
