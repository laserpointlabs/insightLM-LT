import * as fs from "fs";
import * as path from "path";
import { LLMConfig } from "./configService";
import { WorkbookService } from "./workbookService";
import { FileService } from "./fileService";
import { MCPService } from "./mcpService";
import { ToolRegistry } from "./toolRegistry";
import { ToolProviderRegistry } from "./toolProviderRegistry";
import { ToolExecutionContext } from "./types/toolProvider";

export interface LLMMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

export class LLMService {
  private config: LLMConfig;
  private workbookService: WorkbookService;
  private fileService: FileService;
  private ragIndexService?: any; // RAGIndexService
  private mcpService?: MCPService;
  private toolRegistry: ToolRegistry;
  private toolProviderRegistry?: ToolProviderRegistry;
  private availableTools: ToolDefinition[] = [];
  private filesReadInCurrentChat: Array<{ workbookId: string; workbookName: string; filePath: string; filename: string }> = [];

  /**
   * Cached active context scope for the current request / tool execution burst.
   * - null: not yet loaded
   * - { contextId: null }: no active context
   * - { contextId: string, workbookIds: Set<string> }: scope active
   */
  private cachedContextScope: null | { contextId: string | null; workbookIds: Set<string> | null } = null;

  constructor(
    config: LLMConfig,
    workbookService: WorkbookService,
    fileService: FileService,
    ragIndexService?: any,
    mcpService?: MCPService,
    toolRegistry?: ToolRegistry,
    toolProviderRegistry?: ToolProviderRegistry,
  ) {
    this.config = config;
    this.workbookService = workbookService;
    this.fileService = fileService;
    this.ragIndexService = ragIndexService;
    this.mcpService = mcpService;
    this.toolRegistry = toolRegistry || new ToolRegistry();
    this.toolProviderRegistry = toolProviderRegistry;

    // Subscribe to tool registry changes
    this.toolRegistry.subscribe((tools) => {
      this.updateAvailableTools();
    });

    // Register core tools through ToolRegistry for consistency
    this.registerCoreTools();
    this.updateAvailableTools();
  }

  /**
   * Register core tools through ToolRegistry (for consistency with MCP tools)
   */
  private registerCoreTools() {
    const coreTools: ToolDefinition[] = [
      {
        name: "read_workbook_file",
        description:
          "Read the contents of a file in a workbook. Use this to see what documents contain.",
        parameters: {
          type: "object",
          properties: {
            workbookId: {
              type: "string",
              description: "The ID of the workbook (this is the directory name, e.g., 'ac1000-main-project', NOT a UUID). Get this from the 'Workbook ID:' field in RAG search results.",
            },
            filePath: {
              type: "string",
              description:
                'The relative path to the file within the workbook (e.g., "documents/file.txt")',
            },
          },
          required: ["workbookId", "filePath"],
        },
      },
      {
        name: "list_workbooks",
        description:
          "List all available workbooks and their documents. Use this to see what workbooks exist.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "create_file_in_workbook",
        description:
          "Create a new file (like markdown) in a workbook. Use this to create summaries, tables, or any other content.",
        parameters: {
          type: "object",
          properties: {
            workbookId: {
              type: "string",
              description: "The ID of the workbook where to create the file",
            },
            fileName: {
              type: "string",
              description:
                'The name of the file to create (e.g., "summary.md", "analysis.md")',
            },
            content: {
              type: "string",
              description: "The content to write to the file",
            },
          },
          required: ["workbookId", "fileName", "content"],
        },
      },
      {
        name: "search_workbooks",
        description:
          "Search for files across workbooks by filename. Use this to find relevant documents.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query (filename)" },
          },
          required: ["query"],
        },
      },
      {
        name: "list_all_workbook_files",
        description:
          "List all files in all workbooks. Use this to see what documents are available.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];
    
    // Register core tools with ToolRegistry (serverName="core")
    this.toolRegistry.registerTools("core", coreTools);
    console.log(`[LLM] Registered ${coreTools.length} core tools`);
  }

  /**
   * Update available tools from ToolRegistry
   */
  private updateAvailableTools(): void {
    this.availableTools = this.toolRegistry.getAllTools();
    const coreCount = this.toolRegistry.getToolsByServer("core").length;
    const mcpCount = this.availableTools.length - coreCount;
    console.log(`[LLM] Updated available tools: ${coreCount} core + ${mcpCount} MCP = ${this.availableTools.length} total`);
  }

  async chat(messages: LLMMessage[]): Promise<string> {
    // Reset files read tracker for new chat request
    this.filesReadInCurrentChat = [];
    // Reset cached context scope per chat request (so active context changes apply immediately)
    this.cachedContextScope = null;

    // Add system message with tool definitions if not present
    const systemMessage: LLMMessage = {
      role: "system",
      content: this.getSystemPrompt(),
    };

    const messagesWithSystem = messages.some((m) => m.role === "system")
      ? messages
      : [systemMessage, ...messages];

    let response: string;
    switch (this.config.provider) {
      case "openai":
        response = await this.chatWithToolsOpenAI(messagesWithSystem);
        break;
      case "claude":
        response = await this.chatWithToolsClaude(messagesWithSystem);
        break;
      case "ollama":
        response = await this.chatWithToolsOllama(messagesWithSystem);
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }

    // Add file references if any files were read
    if (this.filesReadInCurrentChat.length > 0) {
      const references = this.filesReadInCurrentChat.map(f => {
        // URL-encode the file path to handle spaces and special characters
        const encodedPath = f.filePath.split('/').map(part => encodeURIComponent(part)).join('/');
        return `📄 [${f.filename}](workbook://${f.workbookId}/${encodedPath})`;
      }).join('\n\n');
      response += `\n\n---\n\n**Sources:**\n\n${references}`;
    }

    return response;
  }

  /**
   * Track files from RAG server response
   * RAG response format:
   * **filename** (workbook)
   * Workbook ID: xxx
   * Path: yyy
   */
  private trackFilesFromRAGResponse(content: string): void {
    const filePattern = /\*\*([^*]+)\*\*\s*\(([^)]+)\)\s*\n\s*Workbook ID:\s*([^\n]+)\s*\n\s*Path:\s*([^\n]+)/g;

    let match;
    const seenFiles = new Set<string>();

    while ((match = filePattern.exec(content)) !== null) {
      const filename = match[1].trim();
      const workbookName = match[2].trim();
      const workbookId = match[3].trim();
      const filePath = match[4].trim();

      const fileKey = `${workbookId}:${filePath}`;

      if (!seenFiles.has(fileKey)) {
        seenFiles.add(fileKey);
        this.filesReadInCurrentChat.push({
          workbookId,
          workbookName,
          filePath,
          filename
        });
      }
    }
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant helping users manage and analyze their workbooks and documents.

CRITICAL: When users ask questions about document content, you MUST:
1. ALWAYS use rag_search_content FIRST when users mention filenames or ask about document content (e.g., "what is in spreadsheet-2025-12-12T19-46-01.is", "what is cell C1 in test-spreadsheet")
2. rag_search_content searches INSIDE files (PDFs, Word docs, spreadsheets, text files) and will find files by filename or content
3. After rag_search_content returns results, use read_workbook_file with the exact Workbook ID and Path from the search results to read the full file
4. Answer based on what you READ from the files

IMPORTANT: Use rag_search_content when users ask about:
- Filenames (e.g., "spreadsheet-2025-12-12T19-46-01.is", "test-spreadsheet.is")
- Specific terms or concepts (e.g., "What is BSEO?", "authentication methods")
- Information that might be inside documents (not just filenames)
- Questions where you need to search document content, not just metadata
- Cell values or formulas in spreadsheets (e.g., "what is cell C1")

DO NOT try to answer questions about document content without searching or reading the files first.
DO NOT use list_all_workbook_files or read_workbook_file directly without first using rag_search_content to find the file.

IMPORTANT: Do NOT include a "Sources:" section in your response. The system will automatically add source references at the end.

CONTEXT SCOPING:
- If there is an active Context, tools that list/search files and workbooks are automatically scoped to that Context's workbooks.
- If there is no active Context, tools operate across all workbooks.

Available tools:
${this.availableTools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")}

Example workflow:
User: "What are the key tests for static structural testing?"
You: Call list_all_workbook_files() → find test_plan.md → call read_workbook_file(workbookId, "documents/test_plan.md") → read content → answer with actual content from file

When creating summaries/tables/analyses, use create_file_in_workbook to save as markdown.

File paths are relative to workbook root (e.g., "documents/filename.ext").`;
  }

  private async executeTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<string> {
    try {
      const serverName = this.toolRegistry.getToolServer(toolName);

      if (!serverName) {
        return `Unknown tool: ${toolName}`;
      }

      // Load active context scope once per tool execution burst.
      // This is used to scope core list/search tools and (when supported) to scope RAG search/list tools.
      const scope = await this.getActiveContextScope();

      // If the workbook-rag server supports scoping, inject workbook_ids for active context.
      // This keeps rag_search_content within the active context and prevents cross-context leakage.
      if (
        scope.workbookIds &&
        (toolName === "rag_search_content" || toolName === "rag_list_files") &&
        !Array.isArray(args.workbook_ids)
      ) {
        args = { ...args, workbook_ids: Array.from(scope.workbookIds) };
      }

      // Core tools are executed internally
      if (serverName === "core") {
        return this.executeCoreTool(toolName, args);
      }

      // Use ToolProviderRegistry for tool execution (Phase 3 abstraction)
      if (this.toolProviderRegistry) {
        console.log(`[LLM] Executing tool via provider registry: ${toolName} from ${serverName}`);

        const executionContext: ToolExecutionContext = {
          toolName,
          parameters: args,
          timeout: 60000, // 60 second timeout for tool execution
          metadata: {
            requestId: `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }
        };

        const result = await this.toolProviderRegistry.executeTool(executionContext);

        if (result.success) {
          // Handle rag_search_content specially for file tracking
          if (toolName === "rag_search_content" && result.result?.content) {
            const content = typeof result.result.content === 'string' ? result.result.content : JSON.stringify(result.result.content);
            // Parse RAG response to track sources
            this.trackFilesFromRAGResponse(content);
            // Add explicit instructions for using read_workbook_file with RAG results
            return content + 
              `\n\n[IMPORTANT: When you need to read a file from the search results above, use read_workbook_file with the exact Workbook ID and Path shown. For example, if you see "Workbook ID: ac1000-main-project" and "Path: documents/spreadsheet-2025-12-12T19-46-01.is", call read_workbook_file(workbookId="ac1000-main-project", filePath="documents/spreadsheet-2025-12-12T19-46-01.is"). The workbook ID is the directory name, not a UUID.]`;
          }
          
          // Handle different response formats
          if (result?.result) {
            return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
          }
          if (result?.content) {
            return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
          }
          if (typeof result === 'string') {
            return result;
          }
          return JSON.stringify(result);
        } else {
          // Tool execution failed
          const errorMsg = result.error?.message || 'Unknown execution error';
          console.error(`[LLM] Error executing tool ${toolName}:`, errorMsg);
          return `Error executing ${toolName}: ${errorMsg}`;
        }
      } else if (this.mcpService) {
        // Legacy fallback for backward compatibility (should be removed in future)
        console.log(`[LLM] Falling back to direct MCP execution: ${toolName} from ${serverName}`);
        try {
          const result = await this.mcpService.sendRequest(
            serverName,
            "tools/call",
            { name: toolName, arguments: args },
            60000 // 60 second timeout for tool execution
          );

          // Handle rag_search_content specially for file tracking
          if (toolName === "rag_search_content" && result?.content) {
            const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
            // Parse RAG response to track sources
            this.trackFilesFromRAGResponse(content);
            // Add explicit instructions for using read_workbook_file with RAG results
            return content +
              `\n\n[IMPORTANT: When you need to read a file from the search results above, use read_workbook_file with the exact Workbook ID and Path shown. For example, if you see "Workbook ID: ac1000-main-project" and "Path: documents/spreadsheet-2025-12-12T19-46-01.is", call read_workbook_file(workbookId="ac1000-main-project", filePath="documents/spreadsheet-2025-12-12T19-46-01.is"). The workbook ID is the directory name, not a UUID.]`;
          }

          // Handle different response formats
          if (result?.result) {
            return typeof result.result === 'string' ? result.result : JSON.stringify(result.result);
          }
          if (result?.content) {
            return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
          }
          if (typeof result === 'string') {
            return result;
          }
          return JSON.stringify(result);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[LLM] Error executing MCP tool ${toolName}:`, errorMsg);
          return `Error executing ${toolName}: ${errorMsg}`;
        }
      }

      return `Error: No tool execution mechanism available for ${toolName}`;
    } catch (error) {
      return `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Execute core tools (non-MCP tools)
   */
  private async executeCoreTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<string> {
    const scope = await this.getActiveContextScope();
    const isInScope = (workbookId: string) =>
      !scope.workbookIds || scope.workbookIds.has(workbookId);

    switch (toolName) {
        case "read_workbook_file":
          try {
            console.log(`[LLM] read_workbook_file called with:`);
            console.log(`  workbookId: "${args.workbookId}"`);
            console.log(`  filePath: "${args.filePath}"`);
            
            const content = await this.fileService.readDocument(
              args.workbookId,
              args.filePath,
            );

            // Track file for references
            const workbook = await this.workbookService.getWorkbook(args.workbookId);
            if (workbook) {
              const filename = args.filePath.split('/').pop() || args.filePath;
              this.filesReadInCurrentChat.push({
                workbookId: args.workbookId,
                workbookName: workbook.name,
                filePath: args.filePath,
                filename: filename
              });
            }

            return `File content:\n${content}`;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[LLM] Error reading file:`, errorMsg);
            console.error(`[LLM] Parameters used: workbookId="${args.workbookId}", filePath="${args.filePath}"`);
            
            // Provide more helpful error message
            let helpfulMsg = `Error reading file: ${errorMsg}. `;
            if (!args.workbookId || !args.filePath) {
              helpfulMsg += `Missing required parameters. `;
            }
            helpfulMsg += `Make sure you're using the exact Workbook ID and Path from the RAG search results (e.g., workbookId="ac1000-main-project", filePath="documents/spreadsheet-2025-12-12T19-46-01.is").`;
            return helpfulMsg;
          }

        case "list_workbooks":
          const workbooks = await this.workbookService.getWorkbooks();
          const activeWorkbooks = workbooks
            .filter((w) => !w.archived)
            .filter((w) => isInScope(w.id));
          if (activeWorkbooks.length === 0) {
            return "No workbooks found.";
          }
          return activeWorkbooks
            .map((w) => {
              const docList = w.documents
                .filter((d: any) => !d.archived)
                .map((d: any) => `  - ${d.filename}`)
                .join("\n");
              return `Workbook: ${w.name}\nID: ${w.id}\nDocuments:\n${docList || "  (no documents)"}`;
            })
            .join("\n\n") + "\n\nTo read a file, use the workbook ID (not the name) and the file path shown.";

        case "create_file_in_workbook":
          const fileName = args.fileName.startsWith("documents/")
            ? args.fileName
            : `documents/${args.fileName}`;

          // Create file with content
          const workbookPath = (this.workbookService as any)["workbooksDir"];
          const filePath = path.join(workbookPath, args.workbookId, fileName);
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, args.content, "utf-8");

          // Update workbook metadata
          const metadataPath = path.join(
            workbookPath,
            args.workbookId,
            "workbook.json",
          );
          if (fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
            const finalFileName = fileName.split("/").pop() || args.fileName;
            const existingIndex = metadata.documents.findIndex(
              (d: any) => d.filename === finalFileName,
            );

            if (existingIndex >= 0) {
              metadata.documents[existingIndex].addedAt =
                new Date().toISOString();
            } else {
              metadata.documents.push({
                filename: finalFileName,
                path: fileName,
                addedAt: new Date().toISOString(),
              });
            }
            metadata.updated = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
          }

          return `File "${args.fileName}" created successfully in workbook.`;

        case "search_workbooks":
          const allWorkbooks = await this.workbookService.getWorkbooks();
          const results: string[] = [];
          const query = args.query.toLowerCase();

          for (const wb of allWorkbooks
            .filter((w) => !w.archived)
            .filter((w) => isInScope(w.id))) {
            for (const doc of wb.documents.filter((d: any) => !d.archived)) {
              if (doc.filename.toLowerCase().includes(query)) {
                results.push(`${wb.name}/${doc.filename}`);
              }
            }
          }

          return results.length > 0
            ? `Found ${results.length} file(s):\n${results.map((r) => `- ${r}`).join("\n")}`
            : `No files found matching "${args.query}"`;

        case "list_all_workbook_files":
          const allWb = await this.workbookService.getWorkbooks();
          const fileList: string[] = [];

          for (const wb of allWb
            .filter((w) => !w.archived)
            .filter((w) => isInScope(w.id))) {
            for (const doc of wb.documents.filter((d: any) => !d.archived)) {
              fileList.push(`Workbook: ${wb.name} (ID: ${wb.id})\n  File: ${doc.filename}\n  Path: ${doc.path}`);
            }
          }

          return fileList.length > 0
            ? `All files (${fileList.length} total):\n\n${fileList.join("\n\n")}\n\nTo read a file, use read_workbook_file with the workbook ID and file path.`
            : "No files found in workbooks";

        default:
          return `Unknown tool: ${toolName}`;
    }
  }

  /**
   * Fetch the active context scope (workbook IDs) from the context-manager MCP server.
   * Returns an empty scope if MCP service is unavailable or if no active context is set.
   */
  private async getActiveContextScope(): Promise<{ contextId: string | null; workbookIds: Set<string> | null }> {
    if (this.cachedContextScope) {
      return this.cachedContextScope;
    }

    // Default: no scope (operate across all workbooks)
    const empty = { contextId: null, workbookIds: null as Set<string> | null };

    try {
      if (!this.mcpService) {
        this.cachedContextScope = empty;
        return empty;
      }

      // Only scope if the context-manager server is running
      if (!this.mcpService.isServerRunning("context-manager")) {
        this.cachedContextScope = empty;
        return empty;
      }

      const res = await this.mcpService.sendRequest(
        "context-manager",
        "tools/call",
        { name: "get_context_workbooks", arguments: {} },
        2000,
      );

      const contextId = (res && (res.context_id ?? res.contextId)) || null;
      const workbookIdsRaw = (res && (res.workbook_ids ?? res.workbookIds)) || [];

      if (!contextId || !Array.isArray(workbookIdsRaw) || workbookIdsRaw.length === 0) {
        this.cachedContextScope = empty;
        return empty;
      }

      const workbookIds = new Set<string>(workbookIdsRaw.filter((x: any) => typeof x === "string"));
      this.cachedContextScope = { contextId, workbookIds };
      return this.cachedContextScope;
    } catch (e) {
      // If context-manager is down or errors, fall back to unscoped behavior
      this.cachedContextScope = empty;
      return empty;
    }
  }

  private async chatWithToolsOpenAI(messages: LLMMessage[]): Promise<string> {
    console.log(`[LLM] Calling OpenAI with ${this.availableTools.length} tools available`);
    console.log(`[LLM] Tools: ${this.availableTools.map(t => t.name).join(", ")}`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: this.formatMessagesForOpenAI(messages),
        tools: this.availableTools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error: ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as any;
    const choice = data.choices[0];

    // Handle tool calls
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      console.log(`[LLM] Tool calls requested: ${choice.message.tool_calls.length}`);
      const toolResults: LLMMessage[] = [];

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        console.log(`[LLM] Executing tool: ${toolName}`, toolArgs);
        const result = await this.executeTool(toolName, toolArgs);
        console.log(`[LLM] Tool result length: ${result.length} characters`);

        toolResults.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
          name: toolName,
        });
      }

      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: choice.message.content || "",
        tool_calls: choice.message.tool_calls,
      });

      // Add tool results
      messages.push(...toolResults);

      // Recursively call again with tool results
      return this.chatWithToolsOpenAI(messages);
    }

    return choice.message.content || "";
  }

  private async chatWithToolsClaude(messages: LLMMessage[]): Promise<string> {
    // Claude uses different format - implement similar pattern
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        tools: this.availableTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })),
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "tool" ? "user" : m.role,
            content: m.content,
          })),
        system:
          messages.find((m) => m.role === "system")?.content ||
          this.getSystemPrompt(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API error: ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as any;

    // Handle tool use (Claude's format)
    if (data.content && data.content.some((c: any) => c.type === "tool_use")) {
      const toolResults: LLMMessage[] = [];

      for (const content of data.content) {
        if (content.type === "tool_use") {
          const result = await this.executeTool(content.name, content.input);
          toolResults.push({
            role: "user",
            content: `Tool result for ${content.name}: ${result}`,
          });
        }
      }

      messages.push({
        role: "assistant",
        content: data.content
          .map((c: any) => (c.type === "text" ? c.text : ""))
          .join(""),
      });
      messages.push(...toolResults);

      return this.chatWithToolsClaude(messages);
    }

    return data.content?.[0]?.text || "";
  }

  private async chatWithToolsOllama(messages: LLMMessage[]): Promise<string> {
    // Ollama doesn't support function calling natively, so we'll use a simpler approach
    // Parse the response for tool calls or use a wrapper
    const baseUrl = this.config.baseUrl || "http://localhost:11434";
    const lastMessage = messages[messages.length - 1];

    // For Ollama, we'll use a prompt-based approach to detect tool needs
    const enhancedPrompt = `${this.getSystemPrompt()}\n\nUser: ${lastMessage.content}\n\nThink step by step. If you need to read a file, list workbooks, or create a file, respond with JSON in this format: {"tool": "tool_name", "args": {...}}. Otherwise, respond normally.`;

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: enhancedPrompt,
        stream: false,
        options: {
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    let responseText = data.response || "";

    // Try to parse tool calls from response
    try {
      const toolCallMatch = responseText.match(
        /\{"tool":\s*"([^"]+)",\s*"args":\s*(\{[^}]+\})\}/,
      );
      if (toolCallMatch) {
        const toolName = toolCallMatch[1];
        const toolArgs = JSON.parse(toolCallMatch[2]);
        const result = await this.executeTool(toolName, toolArgs);

        // Continue conversation with tool result
        messages.push({
          role: "assistant",
          content: responseText,
        });
        messages.push({
          role: "user",
          content: `Tool result: ${result}. Please provide your final answer.`,
        });

        const finalResponse = await fetch(`${baseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.config.model,
            prompt: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
            stream: false,
          }),
        });

        const finalData = (await finalResponse.json()) as any;
        return finalData.response || responseText;
      }
    } catch (e) {
      // If parsing fails, just return the response
    }

    return responseText;
  }

  private formatMessagesForOpenAI(messages: LLMMessage[]): any[] {
    const formatted: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === "tool") {
        // Tool messages must have a tool_call_id
        if (!msg.tool_call_id) {
          console.warn("Skipping tool message without tool_call_id");
          continue;
        }
        // Check if there's a preceding assistant message with tool_calls in the ORIGINAL messages array
        // Look backwards from current position to find the most recent assistant message with tool_calls
        let foundAssistantWithToolCalls = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevMsg = messages[j];
          if (prevMsg.role === "assistant" && prevMsg.tool_calls) {
            // Verify this tool_call_id exists in the assistant's tool_calls
            const toolCallExists = prevMsg.tool_calls.some(
              (tc: any) => tc.id === msg.tool_call_id
            );
            if (toolCallExists) {
              foundAssistantWithToolCalls = true;
              break;
            }
          }
          // Stop if we hit a non-assistant message (user/system) - tool messages must follow their assistant message
          if (prevMsg.role !== "assistant" && prevMsg.role !== "tool") {
            break;
          }
        }

        if (!foundAssistantWithToolCalls) {
          console.warn(`Tool message without preceding assistant message with matching tool_calls for tool_call_id: ${msg.tool_call_id}, skipping`);
          continue;
        }

        formatted.push({
          role: "tool",
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        });
      } else if (msg.role === "assistant" && msg.tool_calls) {
        formatted.push({
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.tool_calls,
        });
      } else {
        // Regular user, assistant, or system message
        formatted.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return formatted;
  }
}
