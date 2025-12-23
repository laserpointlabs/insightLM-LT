/**
 * Integration test: jupyter-server should accept workbook:// paths for create_notebook
 * and map them into <INSIGHTLM_DATA_DIR>/workbooks/<id>/...
 */
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function sendRequest(proc, method, params = {}, requestId = 2000) {
  return new Promise((resolve, reject) => {
    let responseBuffer = "";
    let timeoutId;

    const cleanup = () => {
      proc.stdout.removeListener("data", onData);
      clearTimeout(timeoutId);
    };

    const onData = (data) => {
      responseBuffer += data.toString();
      const lines = responseBuffer.split("\n");
      responseBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const response = JSON.parse(trimmed);
          if (response.id === requestId) {
            cleanup();
            if (response.error) reject(new Error(response.error.message || JSON.stringify(response.error)));
            else resolve(response.result || response);
            return;
          }
        } catch {
          // ignore non-json chunks
        }
      }
    };

    proc.stdout.on("data", onData);

    const timeoutMs = process.env.CI ? 20000 : 7000;
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Request timeout for ${method}`));
    }, timeoutMs);

    const request = { jsonrpc: "2.0", id: requestId, method, params };
    proc.stdin.write(JSON.stringify(request) + "\n");
  });
}

async function main() {
  console.log("🧪 jupyter-server workbook:// path mapping\n" + "=".repeat(60));

  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "insightlm-jupyter-path-"));
  const serverCwd = path.join(rootDir, "mcp-servers", "jupyter-server");

  const proc = spawn("python", ["server.py"], {
    cwd: serverCwd,
    stdio: "pipe",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      INSIGHTLM_DATA_DIR: tmpDataDir
    }
  });

  // Wait briefly for the init message to flush.
  await new Promise((r) => setTimeout(r, process.env.CI ? 1500 : 500));

  // Ensure tools are responsive.
  await sendRequest(proc, "tools/list", {}, 2001);

  const wid = "1aae0fc1-e790-493b-a5b3-1cd2bbd4cba2";
  const rel = "documents/test_notebook.ipynb";
  const workbookUrl = `workbook://${wid}/${rel}`;

  // Seed minimal workbook metadata so create_notebook can update it (UI lists from workbook.json).
  const wbDir = path.join(tmpDataDir, "workbooks", wid);
  fs.mkdirSync(path.join(wbDir, "documents"), { recursive: true });
  const metadataPath = path.join(wbDir, "workbook.json");
  fs.writeFileSync(
    metadataPath,
    JSON.stringify({ id: wid, name: "Test WB", documents: [], updated: new Date().toISOString() }, null, 2),
    "utf-8"
  );

  // Call the tool as the app does.
  await sendRequest(
    proc,
    "tools/call",
    { name: "create_notebook", arguments: { path: workbookUrl, kernel_name: "python3" } },
    2002
  );

  // Execute a cell and persist into the same notebook (either via notebook_path or server last-created fallback).
  await sendRequest(
    proc,
    "tools/call",
    { name: "execute_cell", arguments: { code: "2 + 2", kernel_name: "python3", notebook_path: workbookUrl } },
    2003
  );

  const expectedPath = path.join(tmpDataDir, "workbooks", wid, "documents", "test_notebook.ipynb");
  if (!fs.existsSync(expectedPath)) {
    proc.kill();
    throw new Error(`Expected notebook to exist at: ${expectedPath}`);
  }

  // Verify the notebook now contains a trailing executed cell with output "4".
  const nb = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
  const cells = Array.isArray(nb?.cells) ? nb.cells : [];
  const last = cells[cells.length - 1] || {};
  const source = Array.isArray(last.source) ? last.source.join("") : String(last.source || "");
  if (!source.includes("2 + 2")) {
    proc.kill();
    throw new Error(`Expected last cell source to include "2 + 2" but got: ${source}`);
  }
  const outs = Array.isArray(last.outputs) ? last.outputs : [];
  const has4 =
    outs.some((o) => o?.output_type === "execute_result" && String(o?.data?.["text/plain"] || "").includes("4")) ||
    outs.some((o) => o?.output_type === "stream" && String(o?.text || "").includes("4"));
  if (!has4) {
    proc.kill();
    throw new Error(`Expected outputs to include 4; outputs=${JSON.stringify(outs)}`);
  }

  // Verify workbook.json was updated to include the new file.
  const meta = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
  const docs = Array.isArray(meta?.documents) ? meta.documents : [];
  const found = docs.some((d) => d && d.filename === "test_notebook.ipynb" && String(d.path || "").includes("documents/"));
  if (!found) {
    proc.kill();
    throw new Error(`Expected workbook.json to include test_notebook.ipynb in documents; got: ${JSON.stringify(docs)}`);
  }

  console.log("✅ notebook created at expected workbooks/<id>/... location");
  proc.kill();
  // Best-effort cleanup (leave artifacts if something locks on Windows).
  try {
    fs.rmSync(tmpDataDir, { recursive: true, force: true });
  } catch {}
}

main().catch((e) => {
  console.error("❌ Test failed:", e?.message || e);
  process.exit(1);
});
