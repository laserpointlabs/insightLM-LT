/**
 * Tool Provider Registry
 *
 * Manages registration and execution routing for different tool providers.
 * Provides a unified interface for tool execution across multiple provider types.
 */

import { IToolProvider, ProviderRegistrationOptions, ProviderExecutionOptions, ToolExecutionContext, ToolExecutionResult, ToolDefinition, ProviderHealth, ToolExecutionError, ToolExecutionMetadata } from './types/toolProvider';
import { ToolRegistry } from './toolRegistry';

export class ToolProviderRegistry {
  private providers: Map<string, IToolProvider> = new Map();
  private toolToProvider: Map<string, string> = new Map();
  private isInitialized = false;

  constructor(private toolRegistry: ToolRegistry) {}

  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[ToolProviderRegistry] Initializing...');

    // Subscribe to tool registry changes to maintain our mappings
    this.toolRegistry.subscribe((tools) => {
      this.updateToolMappings(tools);
    });

    // Initialize all registered providers
    for (const [name, provider] of this.providers) {
      try {
        console.log(`[ToolProviderRegistry] Initializing provider: ${name}`);
        await provider.initialize();
      } catch (error) {
        console.error(`[ToolProviderRegistry] Failed to initialize provider ${name}:`, error);
      }
    }

    this.isInitialized = true;
    console.log('[ToolProviderRegistry] Initialized successfully');
  }

  /**
   * Shutdown the registry and all providers
   */
  async shutdown(): Promise<void> {
    console.log('[ToolProviderRegistry] Shutting down...');

    for (const [name, provider] of this.providers) {
      try {
        console.log(`[ToolProviderRegistry] Shutting down provider: ${name}`);
        await provider.shutdown();
      } catch (error) {
        console.error(`[ToolProviderRegistry] Failed to shutdown provider ${name}:`, error);
      }
    }

    this.providers.clear();
    this.toolToProvider.clear();
    this.isInitialized = false;

    console.log('[ToolProviderRegistry] Shutdown complete');
  }

  /**
   * Register a new tool provider
   */
  async registerProvider(options: ProviderRegistrationOptions): Promise<void> {
    const { provider, autoInitialize = true, config } = options;

    if (this.providers.has(provider.name)) {
      throw new Error(`Provider ${provider.name} is already registered`);
    }

    console.log(`[ToolProviderRegistry] Registering provider: ${provider.name}`);

    // Apply configuration if provided
    if (config && provider.updateConfiguration) {
      await provider.updateConfiguration(config);
    }

    this.providers.set(provider.name, provider);

    // Initialize if requested
    if (autoInitialize && this.isInitialized) {
      try {
        await provider.initialize();
      } catch (error) {
        console.error(`[ToolProviderRegistry] Failed to initialize provider ${provider.name}:`, error);
        throw error;
      }
    }

    // Register tools provided by this provider
    try {
      const tools = await provider.getAvailableTools();
      console.log(`[ToolProviderRegistry] Provider ${provider.name} provides ${tools.length} tools`);

      // Register tools with the tool registry
      this.toolRegistry.registerTools(provider.name, tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: tool.inputSchema.type,
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required || []
        }
      })));

    } catch (error) {
      console.error(`[ToolProviderRegistry] Failed to get tools from provider ${provider.name}:`, error);
      // Continue anyway - provider might need initialization
    }
  }

  /**
   * Unregister a tool provider
   */
  async unregisterProvider(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      console.warn(`[ToolProviderRegistry] Provider ${providerName} not found`);
      return;
    }

    console.log(`[ToolProviderRegistry] Unregistering provider: ${providerName}`);

    try {
      await provider.shutdown();
    } catch (error) {
      console.error(`[ToolProviderRegistry] Error shutting down provider ${providerName}:`, error);
    }

    // Unregister all tools from this provider
    this.toolRegistry.unregisterTools(providerName);

    this.providers.delete(providerName);

    // Remove tool mappings for this provider
    for (const [tool, provider] of this.toolToProvider) {
      if (provider === providerName) {
        this.toolToProvider.delete(tool);
      }
    }
  }

  /**
   * Execute a tool using the appropriate provider
   */
  async executeTool(
    context: ToolExecutionContext,
    options: ProviderExecutionOptions = {}
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const { preferredProvider, fallbackProviders = [], maxRetries = 1, timeout } = options;

    // Find provider for this tool
    const providerName = preferredProvider || this.toolToProvider.get(context.toolName);
    if (!providerName) {
      return this.createErrorResult(
        context,
        startTime,
        'NO_PROVIDER',
        `No provider found for tool: ${context.toolName}`,
        false
      );
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      return this.createErrorResult(
        context,
        startTime,
        'PROVIDER_NOT_FOUND',
        `Provider ${providerName} not registered`,
        false
      );
    }

    // Check if provider can execute this tool
    if (!provider.canExecute(context.toolName)) {
      return this.createErrorResult(
        context,
        startTime,
        'TOOL_NOT_SUPPORTED',
        `Provider ${providerName} cannot execute tool: ${context.toolName}`,
        false
      );
    }

    // Execute with retry logic
    let lastError: ToolExecutionError | undefined;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        // Apply timeout if specified
        const executionContext = {
          ...context,
          timeout: timeout || context.timeout
        };

        const result = await provider.executeTool(executionContext);

        // Add metadata
        result.metadata = {
          ...result.metadata,
          executionTime: Date.now() - startTime,
          retryCount,
          startTime,
          endTime: Date.now()
        };

        return result;

      } catch (error) {
        console.error(`[ToolProviderRegistry] Tool execution failed (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);

        lastError = {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown execution error',
          retryable: retryCount < maxRetries,
          details: error
        };

        retryCount++;

        // Small delay between retries
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        }
      }
    }

    // All retries failed
    return this.createErrorResult(
      context,
      startTime,
      lastError?.code || 'EXECUTION_FAILED',
      lastError?.message || 'Tool execution failed after retries',
      false,
      lastError?.details
    );
  }

  /**
   * Get all registered providers
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get a specific provider
   */
  getProvider(name: string): IToolProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get health status for all providers
   */
  async getAllProviderHealth(): Promise<Record<string, any>> {
    const health: Record<string, any> = {};

    for (const [name, provider] of this.providers) {
      try {
        health[name] = await provider.getHealth();
      } catch (error) {
        health[name] = {
          status: ProviderHealth.UNKNOWN,
          error: error instanceof Error ? error.message : 'Unknown health check error'
        };
      }
    }

    return health;
  }

  /**
   * Update tool-to-provider mappings
   */
  private updateToolMappings(tools: any[]): void {
    // Clear existing mappings
    this.toolToProvider.clear();

    // Rebuild mappings from tool registry
    // NOTE:
    // - ToolRegistry stores tools by "server" (e.g. "workbook-rag", "context-manager").
    // - Tool providers may NOT be named the same as the server (e.g. "mcp-provider" can execute tools
    //   for many MCP servers). So we map each tool to the first provider that reports it can execute it.
    const providersByPriority = Array.from(this.providers.values()).sort((a, b) => {
      const pa = (a as any).priority ?? 0;
      const pb = (b as any).priority ?? 0;
      return pb - pa;
    });

    for (const tool of tools) {
      const toolName = tool?.name;
      if (!toolName) continue;

      // Fast path: provider name matches tool's server name
      const serverName = this.toolRegistry.getToolServer(toolName);
      if (serverName && this.providers.has(serverName)) {
        this.toolToProvider.set(toolName, serverName);
        continue;
      }

      // Generic path: find a provider that can execute this tool
      const provider = providersByPriority.find((p) => {
        try {
          return p.canExecute(toolName);
        } catch {
          return false;
        }
      });

      if (provider) {
        this.toolToProvider.set(toolName, provider.name);
      }
    }

    console.log(`[ToolProviderRegistry] Updated tool mappings: ${this.toolToProvider.size} tools mapped`);
  }

  /**
   * Create a standardized error result
   */
  private createErrorResult(
    context: ToolExecutionContext,
    startTime: number,
    errorCode: string,
    errorMessage: string,
    retryable: boolean,
    details?: any
  ): ToolExecutionResult {
    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        retryable,
        details
      },
      metadata: {
        provider: 'unknown',
        executionTime: Date.now() - startTime,
        retryCount: 0,
        startTime,
        endTime: Date.now()
      }
    };
  }
}
