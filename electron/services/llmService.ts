import * as fs from "fs";
import * as path from "path";
import { LLMConfig } from "./configService";
import { WorkbookService } from "./workbookService";
import { FileService } from "./fileService";

export interface LLMMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
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
  private availableTools: ToolDefinition[] = [];

  constructor(
    config: LLMConfig,
    workbookService: WorkbookService,
    fileService: FileService,
  ) {
    this.config = config;
    this.workbookService = workbookService;
    this.fileService = fileService;
    this.initializeTools();
  }

  private initializeTools() {
    this.availableTools = [
      {
        name: "read_workbook_file",
        description:
          "Read the contents of a file in a workbook. Use this to see what documents contain.",
        parameters: {
          type: "object",
          properties: {
            workbookId: {
              type: "string",
              description: "The ID of the workbook",
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
          "Search for files across workbooks by filename or content. Use this to find relevant documents.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query" },
          },
          required: ["query"],
        },
      },
    ];
  }

  async chat(messages: LLMMessage[]): Promise<string> {
    // Add system message with tool definitions if not present
    const systemMessage: LLMMessage = {
      role: "system",
      content: this.getSystemPrompt(),
    };

    const messagesWithSystem = messages.some((m) => m.role === "system")
      ? messages
      : [systemMessage, ...messages];

    switch (this.config.provider) {
      case "openai":
        return this.chatWithToolsOpenAI(messagesWithSystem);
      case "claude":
        return this.chatWithToolsClaude(messagesWithSystem);
      case "ollama":
        return this.chatWithToolsOllama(messagesWithSystem);
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant helping users manage and analyze their workbooks and documents.

Available tools:
${this.availableTools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")}

When users ask questions about their documents:
1. First use list_workbooks to see what workbooks exist
2. Use read_workbook_file to read relevant documents
3. Answer questions based on the document content
4. When asked to create summaries, tables, or analyses, use create_file_in_workbook to save them as markdown files

Always render markdown tables and formatting properly in your responses. When creating files, use proper markdown formatting including tables, headers, lists, etc.

Workbook file paths are relative to the workbook root, typically starting with "documents/" for files in the documents folder.`;
  }

  private async executeTool(
    toolName: string,
    args: Record<string, any>,
  ): Promise<string> {
    try {
      switch (toolName) {
        case "read_workbook_file":
          const content = await this.fileService.readDocument(
            args.workbookId,
            args.filePath,
          );
          return `File content:\n${content}`;

        case "list_workbooks":
          const workbooks = await this.workbookService.getWorkbooks();
          const activeWorkbooks = workbooks.filter((w) => !w.archived);
          if (activeWorkbooks.length === 0) {
            return "No workbooks found.";
          }
          return activeWorkbooks
            .map((w) => {
              const docList = w.documents
                .filter((d: any) => !d.archived)
                .map((d: any) => `  - ${d.filename}`)
                .join("\n");
              return `Workbook: ${w.name} (ID: ${w.id})\nDocuments:\n${docList || "  (no documents)"}`;
            })
            .join("\n\n");

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

          for (const wb of allWorkbooks.filter((w) => !w.archived)) {
            for (const doc of wb.documents.filter((d: any) => !d.archived)) {
              if (doc.filename.toLowerCase().includes(query)) {
                results.push(`${wb.name}/${doc.filename}`);
              }
            }
          }

          return results.length > 0
            ? `Found ${results.length} file(s):\n${results.map((r) => `- ${r}`).join("\n")}`
            : `No files found matching "${args.query}"`;

        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error) {
      return `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async chatWithToolsOpenAI(messages: LLMMessage[]): Promise<string> {
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
      const toolResults: LLMMessage[] = [];

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        const result = await this.executeTool(toolName, toolArgs);

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
    return messages.map((msg) => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        };
      }
      if (msg.role === "assistant" && msg.name) {
        return {
          role: "assistant",
          content: msg.content,
          tool_calls: [], // Will be populated by API
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }
}
