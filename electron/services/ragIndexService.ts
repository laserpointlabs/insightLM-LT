import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { ConfigService } from "./configService";

/**
 * RAG Indexing Service
 * Handles automatic indexing of files and chats for the RAG system
 */
export class RAGIndexService {
  private dataDir: string;
  private indexScriptPath: string;
  private isIndexing: boolean = false;
  private indexQueue: Array<{ workbookId: string; filePath: string }> = [];
  private configService: ConfigService;

  constructor(dataDir: string, configService: ConfigService) {
    this.dataDir = dataDir;
    this.configService = configService;

    // Path to the indexing script
    const projectRoot = process.cwd();
    this.indexScriptPath = path.join(
      projectRoot,
      "mcp-servers",
      "workbook-rag",
      "index.py"
    );
  }

  /**
   * Index a single file (incremental indexing)
   * This is called when a file is added or updated
   */
  async indexFile(workbookId: string, relativePath: string): Promise<void> {
    // For now, queue it for batch processing
    // In the future, we can implement true incremental indexing
    this.indexQueue.push({ workbookId, filePath: relativePath });

    // Trigger indexing after a short delay to batch multiple file additions
    setTimeout(() => {
      this.processIndexQueue();
    }, 1000);
  }

  /**
   * Remove a file from the index (when deleted)
   */
  async removeFileFromIndex(workbookId: string, relativePath: string): Promise<void> {
    // For now, we'll need to re-index the entire workbook
    // In the future, we can implement true incremental deletion
    await this.indexWorkbook(workbookId);
  }

  /**
   * Index a single workbook
   */
  async indexWorkbook(workbookId: string): Promise<void> {
    if (this.isIndexing) {
      console.log("Indexing already in progress, skipping...");
      return;
    }

    // For single workbook, we'll re-index everything
    // This is simpler than incremental updates for now
    await this.indexAll();
  }

  /**
   * Index all workbooks (full re-index)
   */
  async indexAll(): Promise<void> {
    if (this.isIndexing) {
      console.log("Indexing already in progress");
      return;
    }

    if (!fs.existsSync(this.indexScriptPath)) {
      console.warn(`Index script not found at ${this.indexScriptPath}`);
      return;
    }

    this.isIndexing = true;
    this.indexQueue = []; // Clear queue since we're doing full index

    return new Promise((resolve, reject) => {
      const llmConfig = this.configService.loadLLMConfig();
      const openaiKey = llmConfig.apiKey;

      if (!openaiKey) {
        console.warn("OpenAI API key not configured, skipping indexing");
        this.isIndexing = false;
        resolve();
        return;
      }

      const env = {
        ...process.env,
        OPENAI_API_KEY: openaiKey,
        INSIGHTLM_DATA_DIR: this.dataDir,
      };

      const pythonCmd = process.platform === "win32" ? "python" : "python3";

      console.log(`Starting RAG indexing: ${this.dataDir}`);

      const proc = spawn(pythonCmd, [this.indexScriptPath, this.dataDir], {
        env,
        cwd: path.dirname(this.indexScriptPath),
        shell: process.platform === "win32",
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
        console.log(`[RAG Index] ${data.toString().trim()}`);
      });

      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
        console.error(`[RAG Index Error] ${data.toString().trim()}`);
      });

      proc.on("close", (code) => {
        this.isIndexing = false;
        if (code === 0) {
          console.log("RAG indexing completed successfully");
          resolve();
        } else {
          console.error(`RAG indexing failed with code ${code}`);
          console.error(`STDERR: ${stderr}`);
          reject(new Error(`Indexing failed: ${stderr || stdout}`));
        }
      });

      proc.on("error", (error) => {
        this.isIndexing = false;
        console.error("RAG indexing process error:", error);
        reject(error);
      });
    });
  }

  /**
   * Process the indexing queue (batch indexing)
   */
  private async processIndexQueue(): Promise<void> {
    if (this.indexQueue.length === 0 || this.isIndexing) {
      return;
    }

    // For now, just do a full re-index
    // In the future, we can implement true incremental indexing
    const queue = [...this.indexQueue];
    this.indexQueue = [];

    console.log(`Processing ${queue.length} files from queue, doing full re-index...`);
    await this.indexAll();
  }

  /**
   * Index chat messages
   */
  async indexChat(workbookId: string | null, messages: Array<{ role: string; content: string }>): Promise<void> {
    // Chat indexing will be handled separately
    // For now, we'll store chats and index them in batches
    // This is a placeholder - full implementation needed
    console.log(`Indexing chat with ${messages.length} messages for workbook ${workbookId || 'global'}`);
  }
}



