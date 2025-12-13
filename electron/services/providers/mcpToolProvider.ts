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

    // MCP service is already initialized by main.ts
    // We just need to ensure our server configs are registered
    for (const [serverName, config] of this.serverConfigs) {
      if (!this.mcpService.isServerRunning(serverName)) {
        try {
          console.log(`[MCPToolProvider] Starting MCP server: ${serverName}`);
          // MCP provider doesn't control server paths - let MCPService handle it
          this.mcpService.startServer(config, "");
        } catch (error) {
          console.error(`[MCPToolProvider] Failed to start server ${serverName}:`, error);
        }
      }
    }

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

      // MCP tools are called with "tools/call" method
      const result = await this.mcpService.sendRequest(
        serverName,
        "tools/call",
        {
          name: context.toolName,
          arguments: context.parameters
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
