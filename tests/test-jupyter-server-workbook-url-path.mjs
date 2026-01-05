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

  // Execute a cell and persist into the same notebook.
  await sendRequest(
    proc,
    "tools/call",
    { name: "execute_cell", arguments: { code: "2 + 2", kernel_name: "python3", notebook_path: workbookUrl } },
    2003
  );

  // Verify cwd is set to the notebook's directory by running %pwd (this is the real user repro).
  const pwdRes1 = await sendRequest(
    proc,
    "tools/call",
    { name: "execute_cell", arguments: { code: "%pwd", kernel_name: "python3", notebook_path: workbookUrl } },
    20031
  );
  const out1 = Array.isArray(pwdRes1?.outputs) ? pwdRes1.outputs : (pwdRes1?.result?.outputs || []);
  const expectedDir1 = path.join(tmpDataDir, "workbooks", wid, "documents");
  const tmpBase = path.basename(tmpDataDir);
  const pwd1Raw =
    (out1 || []).find((o) => o?.output_type === "execute_result")?.data?.["text/plain"] ||
    (out1 || []).find((o) => o?.output_type === "stream")?.text ||
    "";
  let pwd1 = String(pwd1Raw || "").trim().replace(/^['"]|['"]$/g, "");
  // `%pwd` often comes back as a Python repr string with escaped backslashes.
  pwd1 = pwd1.replace(/\\\\/g, "\\");
  const pwd1Norm = String(pwd1 || "").replace(/\//g, "\\").toLowerCase();
  const expectedTail1 = path.join(tmpBase, "workbooks", wid, "documents").replace(/\//g, "\\").toLowerCase();
  if (!pwd1Norm.includes(expectedTail1)) {
    proc.kill();
    throw new Error(`Expected %pwd output to include ${expectedTail1} but got ${pwd1Norm}; outputs=${JSON.stringify(out1 || [])}`);
  }

  // Force a cwd switch by running against a different workbook's notebook directory (exercises set_cwd()).
  const wid2 = "2b8f0c3e-2a62-4d92-9c8c-1a0c6f79a111";
  const rel2 = "documents/other_notebook.ipynb";
  const workbookUrl2 = `workbook://${wid2}/${rel2}`;
  const wbDir2 = path.join(tmpDataDir, "workbooks", wid2);
  fs.mkdirSync(path.join(wbDir2, "documents"), { recursive: true });
  fs.writeFileSync(
    path.join(wbDir2, "workbook.json"),
    JSON.stringify({ id: wid2, name: "Test WB 2", documents: [], updated: new Date().toISOString() }, null, 2),
    "utf-8"
  );
  await sendRequest(
    proc,
    "tools/call",
    { name: "create_notebook", arguments: { path: workbookUrl2, kernel_name: "python3" } },
    20032
  );
  const pwdRes2 = await sendRequest(
    proc,
    "tools/call",
    { name: "execute_cell", arguments: { code: "%pwd", kernel_name: "python3", notebook_path: workbookUrl2 } },
    20033
  );
  const out2 = Array.isArray(pwdRes2?.outputs) ? pwdRes2.outputs : (pwdRes2?.result?.outputs || []);
  const expectedDir2 = path.join(tmpDataDir, "workbooks", wid2, "documents");
  const pwd2Raw =
    (out2 || []).find((o) => o?.output_type === "execute_result")?.data?.["text/plain"] ||
    (out2 || []).find((o) => o?.output_type === "stream")?.text ||
    "";
  let pwd2 = String(pwd2Raw || "").trim().replace(/^['"]|['"]$/g, "");
  // `%pwd` often comes back as a Python repr string with escaped backslashes.
  pwd2 = pwd2.replace(/\\\\/g, "\\");
  const pwd2Norm = String(pwd2 || "").replace(/\//g, "\\").toLowerCase();
  const expectedTail2 = path.join(tmpBase, "workbooks", wid2, "documents").replace(/\//g, "\\").toLowerCase();
  if (!pwd2Norm.includes(expectedTail2)) {
    proc.kill();
    throw new Error(`Expected %pwd output to include ${expectedTail2} but got ${pwd2Norm}; outputs=${JSON.stringify(out2 || [])}`);
  }

  // Execute again WITHOUT notebook_path; should FAIL (strict: no fallbacks allowed).
  let missingPathFailed = false;
  try {
    await sendRequest(proc, "tools/call", { name: "execute_cell", arguments: { code: "3 + 3", kernel_name: "python3" } }, 2004);
  } catch (e) {
    missingPathFailed = String(e?.message || e).toLowerCase().includes("notebook_path");
  }
  if (!missingPathFailed) {
    proc.kill();
    throw new Error("Expected execute_cell without notebook_path to fail with a notebook_path error");
  }

  const expectedPath = path.join(tmpDataDir, "workbooks", wid, "documents", "test_notebook.ipynb");
  if (!fs.existsSync(expectedPath)) {
    proc.kill();
    throw new Error(`Expected notebook to exist at: ${expectedPath}`);
  }

  // Verify the notebook contains an executed cell with output "4".
  // (We may have appended additional cells afterward, e.g. %pwd checks.)
  const nb = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
  const cells = Array.isArray(nb?.cells) ? nb.cells : [];
  const cell22 = cells.find((c) => {
    const src = Array.isArray(c?.source) ? c.source.join("") : String(c?.source || "");
    return src.includes("2 + 2");
  });
  if (!cell22) {
    proc.kill();
    throw new Error(`Expected notebook to include a cell with source "2 + 2" but it was not found`);
  }
  const outs = Array.isArray(cell22.outputs) ? cell22.outputs : [];
  const has4 =
    outs.some((o) => o?.output_type === "execute_result" && String(o?.data?.["text/plain"] || "").includes("4")) ||
    outs.some((o) => o?.output_type === "stream" && String(o?.text || "").includes("4"));
  if (!has4) {
    proc.kill();
    throw new Error(`Expected outputs to include 4 for the "2 + 2" cell; outputs=${JSON.stringify(outs)}`);
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
