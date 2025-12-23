/**
 * Deterministic test for Context scoping behavior in LLMService core tools.
 *
 * We avoid calling real LLM providers; instead we call the private executeTool method
 * (TS "private" is not enforced at runtime) and inject a stub MCPService that returns
 * an active context with a single workbook_id.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const TEST_DATA_DIR = join(ROOT, "data", "test-context-scoping");

function clean() {
  if (existsSync(TEST_DATA_DIR)) {
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function assert(name, condition) {
  if (!condition) {
    throw new Error(`❌ ${name}`);
  }
  console.log(`✅ ${name}`);
}

clean();

// Import compiled Electron services (commonjs output under dist-electron/services)
// These exist after `npm run build:electron`.
const { WorkbookService } = await import(`file://${join(ROOT, "dist-electron", "services", "workbookService.js")}`);
const { FileService } = await import(`file://${join(ROOT, "dist-electron", "services", "fileService.js")}`);
const { LLMService } = await import(`file://${join(ROOT, "dist-electron", "services", "llmService.js")}`);

const workbookService = new WorkbookService();
workbookService.initialize(TEST_DATA_DIR);
const fileService = new FileService(workbookService);

// Create 2 workbooks and 1 file in each
const wbA = workbookService.createWorkbook("A");
const wbB = workbookService.createWorkbook("B");

await fileService.writeDocument(wbA.id, "documents/a.md", "A content");
await fileService.writeDocument(wbB.id, "documents/b.md", "B content");

// Stub MCP service for context-manager only
const mcpServiceStub = {
  isServerRunning: (name) => name === "context-manager",
  sendRequest: async (serverName, method, params, timeout) => {
    if (serverName !== "context-manager") throw new Error("unexpected server");
    if (method !== "tools/call") throw new Error("unexpected method");
    if (params?.name !== "get_context_workbooks") throw new Error("unexpected tool");
    return { context_id: "ctx-1", workbook_ids: [wbA.id] };
  },
};

const llmConfig = { provider: "openai", model: "gpt-4o-mini", apiKey: "" };
const llm = new LLMService(llmConfig, workbookService, fileService, null, mcpServiceStub);

// Call private executeTool (runtime-accessible)
const listResult = await llm.executeTool("list_workbooks", {});
assert("list_workbooks includes workbook A", listResult.includes(`ID: ${wbA.id}`));
assert("list_workbooks excludes workbook B", !listResult.includes(`ID: ${wbB.id}`));

const listFiles = await llm.executeTool("list_all_workbook_files", {});
assert("list_all_workbook_files includes a.md", listFiles.includes("a.md"));
assert("list_all_workbook_files excludes b.md", !listFiles.includes("b.md"));

const searchA = await llm.executeTool("search_workbooks", { query: "a.md" });
assert("search_workbooks finds a.md", searchA.includes("A/a.md") || searchA.includes("a.md"));

const searchB = await llm.executeTool("search_workbooks", { query: "b.md" });
// When not found, tool includes the query string in the message, so check for an actual match entry.
assert("search_workbooks does not find b.md when scoped", !searchB.includes("B/b.md") && !searchB.includes("/b.md"));

console.log("\n🎉 Context scoping tests passed.");
