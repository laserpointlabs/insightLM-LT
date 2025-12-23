import { ToolDefinition } from "./llmService";

/**
 * ToolRegistry manages dynamic tool registration from MCP servers.
 * This decouples the LLM service from hardcoded tool definitions.
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition & { serverName: string }> = new Map();
  private listeners: Set<(tools: ToolDefinition[]) => void> = new Set();

  /**
   * Register tools from an MCP server
   */
  registerTools(serverName: string, tools: ToolDefinition[]): void {
    console.log(`[ToolRegistry] Registering ${tools.length} tools from ${serverName}`);
    
    // Remove existing tools from this server first
    this.unregisterTools(serverName);
    
    // Register new tools
    tools.forEach(tool => {
      if (this.tools.has(tool.name)) {
        console.warn(`[ToolRegistry] Tool ${tool.name} already registered by ${this.tools.get(tool.name)?.serverName}, replacing with ${serverName}`);
      }
      this.tools.set(tool.name, { ...tool, serverName });
      console.log(`[ToolRegistry] Registered tool: ${tool.name} from ${serverName}`);
    });
    
    this.notifyListeners();
  }

  /**
   * Unregister all tools from a specific server
   */
  unregisterTools(serverName: string): void {
    console.log(`[ToolRegistry] unregisterTools called for server: ${serverName}`);
    console.log(`[ToolRegistry] Current tool count: ${this.tools.size}`);
    
    const toRemove: string[] = [];
    this.tools.forEach((tool, name) => {
      if (tool.serverName === serverName) {
        toRemove.push(name);
        console.log(`[ToolRegistry] Found tool to remove: ${name} (server: ${tool.serverName})`);
      }
    });
    
    console.log(`[ToolRegistry] Found ${toRemove.length} tools to remove from ${serverName}`);
    
    toRemove.forEach(name => {
      const tool = this.tools.get(name);
      console.log(`[ToolRegistry] Unregistering tool: ${name} from ${tool?.serverName}`);
      this.tools.delete(name);
    });
    
    console.log(`[ToolRegistry] After removal, tool count: ${this.tools.size}`);
    
    if (toRemove.length > 0) {
      console.log(`[ToolRegistry] Notifying ${this.listeners.size} listeners`);
      this.notifyListeners();
    } else {
      console.warn(`[ToolRegistry] No tools found to remove for server: ${serverName}`);
    }
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(({ serverName, ...tool }) => tool);
  }

  /**
   * Get the server name that provides a specific tool
   */
  getToolServer(toolName: string): string | undefined {
    return this.tools.get(toolName)?.serverName;
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all tools from a specific server
   */
  getToolsByServer(serverName: string): ToolDefinition[] {
    const serverTools: ToolDefinition[] = [];
    this.tools.forEach((tool, name) => {
      if (tool.serverName === serverName) {
        const { serverName: _, ...toolDef } = tool;
        serverTools.push(toolDef);
      }
    });
    return serverTools;
  }

  /**
   * Subscribe to tool registration changes
   */
  subscribe(listener: (tools: ToolDefinition[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const allTools = this.getAllTools();
    console.log(`[ToolRegistry] Notifying ${this.listeners.size} listeners of ${allTools.length} total tools`);
    this.listeners.forEach(listener => {
      try {
        listener(allTools);
      } catch (error) {
        console.error(`[ToolRegistry] Listener error:`, error);
      }
    });
  }
}
