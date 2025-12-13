import { MCPService } from "./mcpService";
import { ToolRegistry } from "./toolRegistry";
import { LLMService } from "./llmService";
import { DashboardPromptService } from "./dashboardPromptService";

export interface DashboardQueryRequest {
  question: string;
  tileType?: string;
}

export interface DashboardQueryResponse {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * DashboardQueryService manages the dashboard query flow (Phase 4 - decoupled):
 * 1. Use DashboardPromptService to create format-agnostic prompts
 * 2. Call LLM with structured prompt (LLM uses RAG tools)
 * 3. Format LLM response using dashboard MCP server (pure formatter)
 */
export class DashboardQueryService {
  constructor(
    private mcpService: MCPService,
    private toolRegistry: ToolRegistry,
    private llmService: LLMService,
    private promptService: DashboardPromptService
  ) {}

  /**
   * Execute a dashboard query using the decoupled 3-step flow (Phase 4)
   */
  async executeQuery(request: DashboardQueryRequest): Promise<DashboardQueryResponse> {
    try {
      // Step 0: Find dashboard server for formatting (only needs format_llm_response tool)
      const dashboardServer = this.toolRegistry.getToolServer("format_llm_response");
      if (!dashboardServer) {
        return {
          success: false,
          error: "No dashboard formatting server available. Please ensure a dashboard MCP server is running."
        };
      }

      if (!this.mcpService.isServerRunning(dashboardServer)) {
        return {
          success: false,
          error: `Dashboard server ${dashboardServer} is not running`
        };
      }

      // Step 1: Create prompt using DashboardPromptService (decoupled from MCP)
      const promptResponse = this.promptService.createPrompt({
        question: request.question,
        tileType: request.tileType || "counter"
      });

      if (!promptResponse.success || !promptResponse.prompt) {
        return {
          success: false,
          error: promptResponse.error || "Failed to create prompt"
        };
      }

      // Step 2: Call LLM with structured prompt (LLM will use RAG tools)
      const llmMessages = [
        { role: "system" as const, content: promptResponse.prompt.systemPrompt },
        { role: "user" as const, content: promptResponse.prompt.userQuestion }
      ];

      const llmResponse = await this.llmService.chat(llmMessages);

      // Log for debugging
      console.log("[DashboardService] Question:", request.question);
      console.log("[DashboardService] Tile Type:", request.tileType || "counter");
      console.log("[DashboardService] LLM Response:", llmResponse.substring(0, 200));

      // Step 3: Format LLM response using dashboard MCP server (pure formatter)
      const formatResponse = await this.mcpService.sendRequest(
        dashboardServer,
        "tools/call",
        {
          name: "format_llm_response",
          arguments: {
            llmResponse: llmResponse,
            tileType: promptResponse.tileType
          }
        }
      );

      // MCP service returns the result field from JSON-RPC response
      const formattedResult = formatResponse?.result || formatResponse;

      console.log("[DashboardService] Formatted Result:", JSON.stringify(formattedResult).substring(0, 200));

      return {
        success: true,
        result: formattedResult
      };
    } catch (error) {
      console.error("[DashboardService] Error in dashboard query:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Check if dashboard capabilities are available (Phase 4 - format-agnostic)
   */
  isAvailable(): boolean {
    const dashboardServer = this.toolRegistry.getToolServer("format_llm_response");
    return dashboardServer !== undefined &&
           this.mcpService.isServerRunning(dashboardServer);
  }

  /**
   * Get the name of the dashboard server currently in use
   */
  getDashboardServerName(): string | undefined {
    return this.toolRegistry.getToolServer("format_llm_response");
  }
}
