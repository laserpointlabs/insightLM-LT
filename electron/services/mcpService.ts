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

    const fullCommandPath = path.join(serverPath, config.command);
    const args = config.args.map((arg) =>
      arg === "server.py" ? path.join(serverPath, "server.py") : arg,
    );

    const env = {
      ...process.env,
      ...config.env,
    };

    const proc = spawn(fullCommandPath, args, {
      cwd: serverPath,
      env,
      stdio: "pipe",
    });

    proc.on("error", (error) => {
      console.error(`MCP server ${config.name} error:`, error);
      this.servers.delete(config.name);
    });

    proc.on("exit", (code) => {
      console.log(`MCP server ${config.name} exited with code ${code}`);
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
