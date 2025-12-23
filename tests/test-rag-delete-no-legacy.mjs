#!/usr/bin/env node
/**
 * Regression: deleting a file should not leave "legacy" searchable content in workbook-rag.
 *
 * This uses the workbook-rag MCP server directly with a temp INSIGHTLM_DATA_DIR.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), "insightlm-rag-delete-"));
  const workbooksDir = join(dataDir, "workbooks");
  mkdirSync(workbooksDir, { recursive: true });

  const workbookId = "wb-test";
  const wbDir = join(workbooksDir, workbookId);
  mkdirSync(join(wbDir, "documents"), { recursive: true });

  const filename = "legacy-delete-test.md";
  const relPath = `documents/${filename}`;
  const absFile = join(wbDir, "documents", filename);
  const unique = `UNIQUE_DELETE_TOKEN_${Date.now()}`;
  writeFileSync(absFile, `# Test\n\n${unique}\n`, "utf-8");

  const metaPath = join(wbDir, "workbook.json");
  const meta = {
    id: workbookId,
    name: "RAG Delete Test",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    folders: [],
    documents: [
      {
        docId: "doc-1",
        filename,
        path: relPath,
        addedAt: new Date().toISOString(),
        fileType: "md",
      },
    ],
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");

  const python = process.platform === "win32" ? "python" : "python3";
  const proc = spawn(python, ["mcp-servers/workbook-rag/server.py"], {
    env: { ...process.env, INSIGHTLM_DATA_DIR: dataDir },
    stdio: ["pipe", "pipe", "inherit"],
    shell: process.platform === "win32",
  });

  let buffer = "";
  const lines = [];
  proc.stdout.on("data", (d) => {
    buffer += d.toString();
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) lines.push(line);
    }
  });

  const send = (obj) => proc.stdin.write(JSON.stringify(obj) + "\n");
  const recv = async (id, timeoutMs = 10000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (let i = 0; i < lines.length; i++) {
        try {
          const msg = JSON.parse(lines[i]);
          if (msg && msg.id === id) {
            lines.splice(i, 1);
            return msg;
          }
        } catch {
          // ignore
        }
      }
      await wait(50);
    }
    return null;
  };

  try {
    // Wait for init message (id=1 in this server)
    const init = await recv(1, 10000);
    if (!init?.result?.serverInfo?.name) fail("workbook-rag did not initialize");
    ok("workbook-rag started");

    // Search should find unique token.
    send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "rag_search_content", arguments: { query: unique } },
    });
    const res1 = await recv(2, 15000);
    const content1 = res1?.result?.content || "";
    if (!content1.includes(filename) || !content1.includes(unique)) {
      fail("Expected search to find the document before deletion");
    }
    ok("Search finds document before deletion");

    // Delete file AND remove metadata entry (simulates app behavior).
    rmSync(absFile, { force: true });
    meta.documents = [];
    meta.updated = new Date().toISOString();
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");

    // Search should not return the deleted content.
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "rag_search_content", arguments: { query: unique } },
    });
    const res2 = await recv(3, 15000);
    const content2 = res2?.result?.content || "";
    if (content2.includes(filename) || content2.includes(unique)) {
      fail("Search still returned deleted content (legacy cache/data)");
    }
    ok("Search does not return deleted content");

    process.exit(0);
  } finally {
    try { proc.kill(); } catch {}
    try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));

