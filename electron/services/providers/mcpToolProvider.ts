/**
 * MCP Tool Provider
 *
 * Implements IToolProvider for MCP (Model Context Protocol) servers.
 * Wraps the existing MCPService to provide a standardized tool execution interface.
 */

import {
  IToolProvider,
  ToolCapability,
  ProviderHealth,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolDefinition,
  ProviderHealthStatus
} from '../types/toolProvider';
import { MCPService, MCPServerConfig } from '../mcpService';
import { ToolRegistry } from '../toolRegistry';

export class MCPToolProvider implements IToolProvider {
  readonly name: string;
  readonly capabilities: ToolCapability[];
  readonly priority: number;

  private mcpService: MCPService;
  private toolRegistry: ToolRegistry;
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private initialized = false;

  constructor(
    name: string,
    mcpService: MCPService,
    toolRegistry: ToolRegistry,
    serverConfigs: MCPServerConfig[],
    priority: number = 100
  ) {
    this.name = name;
    this.capabilities = [
      ToolCapability.TEXT_PROCESSING,
      ToolCapability.DATA_ANALYSIS,
      ToolCapability.FILE_OPERATIONS,
      ToolCapability.COMPUTATION,
      ToolCapability.EXTERNAL_API
    ];
    this.priority = priority;
    this.mcpService = mcpService;
    this.toolRegistry = toolRegistry;

    // Store server configurations
    for (const config of serverConfigs) {
      this.serverConfigs.set(config.name, config);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(`[MCPToolProvider] Initializing provider: ${this.name}`);

    // IMPORTANT:
    // Server lifecycle is owned by `electron/main.ts` (auto-start) and by extensions (extension-managed).
    // This provider should NOT start servers itself — doing so without a correct serverPath can crash servers
    // and slow app startup (e.g., spawning python with a wrong CWD, looking for server.py in the repo root).

    this.initialized = true;
    console.log(`[MCPToolProvider] Provider ${this.name} initialized`);
  }

  async shutdown(): Promise<void> {
    console.log(`[MCPToolProvider] Shutting down provider: ${this.name}`);

    // Stop all servers managed by this provider
    for (const serverName of this.serverConfigs.keys()) {
      try {
        console.log(`[MCPToolProvider] Stopping MCP server: ${serverName}`);
        this.mcpService.stopServer(serverName);
      } catch (error) {
        console.error(`[MCPToolProvider] Failed to stop server ${serverName}:`, error);
      }
    }

    this.initialized = false;
    console.log(`[MCPToolProvider] Provider ${this.name} shutdown complete`);
  }

  canExecute(toolName: string): boolean {
    // Check if any of our servers provides this tool
    const serverName = this.toolRegistry.getToolServer(toolName);
    return serverName !== undefined && this.serverConfigs.has(serverName);
  }

  async executeTool(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Find which server provides this tool
      const serverName = this.toolRegistry.getToolServer(context.toolName);
      if (!serverName) {
        throw new Error(`No MCP server found for tool: ${context.toolName}`);
      }

      // Ensure server is running
      if (!this.mcpService.isServerRunning(serverName)) {
        throw new Error(`MCP server ${serverName} is not running`);
      }

      // Execute the tool via MCP
      console.log(`[MCPToolProvider] Executing tool ${context.toolName} via server ${serverName}`);

      // Normalize common app-specific URL-ish args into server-friendly relative paths.
      // Keep this fail-soft (never throw here) to avoid breaking unrelated tools.
      const normalizedParameters = this.normalizeToolArgs(context.parameters, context.metadata);

      // MCP tools are called with "tools/call" method
      const result = await this.mcpService.sendRequest(
        serverName,
        "tools/call",
        {
          name: context.toolName,
          arguments: normalizedParameters
        },
        context.timeout || 30000
      );

      return {
        success: true,
        result: result,
        metadata: {
          provider: this.name,
          executionTime: Date.now() - startTime,
          retryCount: 0,
          startTime,
          endTime: Date.now(),
          providerMetadata: {
            serverName,
            mcpMethod: "tools/call"
          }
        }
      };

    } catch (error) {
      console.error(`[MCPToolProvider] Tool execution failed:`, error);

      return {
        success: false,
        error: {
          code: error instanceof Error ? 'MCP_EXECUTION_ERROR' : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown MCP execution error',
          retryable: true, // MCP errors are generally retryable
          details: error
        },
        metadata: {
          provider: this.name,
          executionTime: Date.now() - startTime,
          retryCount: 0,
          startTime,
          endTime: Date.now()
        }
      };
    }
  }

  /**
   * Best-effort normalization for tool parameters.
   * Today, this mainly supports mapping `workbook://<id>/<path>` to a relative
   * filesystem path (`workbooks/<id>/<path>`) for servers that expect paths
   * rooted under INSIGHTLM_DATA_DIR.
   */
  private normalizeToolArgs(parameters: Record<string, any>, metadata?: Record<string, any>): Record<string, any> {
    try {
      if (!parameters || typeof parameters !== 'object') return parameters;

      // Clone shallowly to avoid mutating shared references.
      const out: Record<string, any> = { ...parameters };
      const scopedWorkbookId = typeof metadata?.workbookId === "string" ? metadata.workbookId : null;

      // Convention: many tools accept a `path` parameter.
      if (typeof out.path === 'string') {
        const p = out.path.trim();
        if (p.toLowerCase().startsWith('workbook://')) {
          const raw = p.replace(/\\/g, '/'); // normalize slashes
          const tail = raw.slice('workbook://'.length);
          const parts = tail.split('/').filter(Boolean);
          const workbookId = decodeURIComponent(parts[0] || '').trim();
          const rel = parts.slice(1).join('/');
          if (workbookId && rel) {
            // Use POSIX separators so Python Path() handles it consistently.
            out.path = `workbooks/${workbookId}/${decodeURIComponent(rel)}`;
          }
        } else if (scopedWorkbookId && p.replace(/\\/g, "/").startsWith("documents/")) {
          // If caller is scoped to one workbook, map notebook paths into that workbook.
          // This prevents writes to <dataDir>/documents/... which the UI does not treat as workbook files.
          const rel = p.replace(/\\/g, "/");
          out.path = `workbooks/${scopedWorkbookId}/${rel}`;
        }
      }

      // Some tools use notebook_path (execute_cell persistence) or file_path-like args.
      const normalizeMaybeWorkbookPath = (key: string) => {
        if (typeof out[key] !== "string") return;
        const p = String(out[key]).trim();
        if (!p) return;
        const norm = p.replace(/\\/g, "/");
        if (norm.toLowerCase().startsWith("workbook://")) {
          const tail = norm.slice("workbook://".length);
          const parts = tail.split("/").filter(Boolean);
          const workbookId = decodeURIComponent(parts[0] || "").trim();
          const rel = parts.slice(1).join("/");
          if (workbookId && rel) out[key] = `workbooks/${workbookId}/${decodeURIComponent(rel)}`;
          return;
        }
        if (scopedWorkbookId && norm.startsWith("documents/")) {
          out[key] = `workbooks/${scopedWorkbookId}/${norm}`;
        }
      };

      normalizeMaybeWorkbookPath("notebook_path");

      return out;
    } catch {
      // Fail-soft: return original args untouched.
      return parameters;
    }
  }

  async getHealth(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    let healthyServers = 0;
    let totalServers = this.serverConfigs.size;
    let errors: string[] = [];

    // Check health of all servers
    for (const [serverName, config] of this.serverConfigs) {
      try {
        if (this.mcpService.isServerRunning(serverName)) {
          healthyServers++;
        } else {
          errors.push(`${serverName}: not running`);
        }
      } catch (error) {
        errors.push(`${serverName}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    const responseTime = Date.now() - startTime;

    let status: ProviderHealth;
    if (healthyServers === totalServers) {
      status = ProviderHealth.HEALTHY;
    } else if (healthyServers > 0) {
      status = ProviderHealth.DEGRADED;
    } else {
      status = ProviderHealth.UNHEALTHY;
    }

    return {
      status,
      lastChecked: Date.now(),
      responseTime,
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      metrics: {
        totalServers,
        healthyServers,
        unhealthyServers: totalServers - healthyServers
      }
    };
  }

  async getAvailableTools(): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    // Get tools from all our servers
    for (const serverName of this.serverConfigs.keys()) {
      if (this.mcpService.isServerRunning(serverName)) {
        try {
          // Try to get tools via tools/list
          const toolList = await this.mcpService.sendRequest(serverName, "tools/list", {});
          if (toolList && toolList.tools) {
            for (const tool of toolList.tools) {
              tools.push({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema || tool.parameters || { type: 'object', properties: {} },
                provider: this.name,
                metadata: {
                  serverName,
                  mcpProvider: true
                }
              });
            }
          }
        } catch (error) {
          console.warn(`[MCPToolProvider] Failed to get tools from server ${serverName}:`, error);
        }
      }
    }

    console.log(`[MCPToolProvider] Found ${tools.length} tools across ${this.serverConfigs.size} servers`);
    return tools;
  }

  async updateConfiguration(config: Record<string, any>): Promise<void> {
    console.log(`[MCPToolProvider] Updating configuration for provider: ${this.name}`);

    // Handle MCP-specific configuration updates
    if (config.serverConfigs) {
      // Update server configurations
      this.serverConfigs.clear();
      for (const serverConfig of config.serverConfigs) {
        this.serverConfigs.set(serverConfig.name, serverConfig);
      }
      console.log(`[MCPToolProvider] Updated server configurations: ${this.serverConfigs.size} servers`);
    }

    // Re-initialize if already initialized
    if (this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Add a new server to this provider
   */
  addServer(config: MCPServerConfig): void {
    this.serverConfigs.set(config.name, config);
    console.log(`[MCPToolProvider] Added server: ${config.name}`);
  }

  /**
   * Remove a server from this provider
   */
  removeServer(serverName: string): void {
    if (this.serverConfigs.has(serverName)) {
      this.serverConfigs.delete(serverName);
      console.log(`[MCPToolProvider] Removed server: ${serverName}`);
    }
  }

  /**
   * Get all server configurations
   */
  getServerConfigs(): MCPServerConfig[] {
    return Array.from(this.serverConfigs.values());
  }
}
