#!/usr/bin/env node
/**
 * Local "production renderer" smoke without electron-builder.
 *
 * Why:
 * - On Windows without Developer Mode/Admin, electron-builder can fail due to symlink privilege.
 * - This runner loads the built renderer (`dist/`) in Electron (no Vite), then runs the CDP UI smoke.
 *
 * Usage:
 * - npm run test:automation:prod
 */

import { spawn } from "child_process";
import electronPath from "electron";
import WebSocket from "ws";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

const CDP_HOST = "127.0.0.1";
const CDP_PORT = 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SHOW_ELECTRON_LOGS =
  String(process.env.INSIGHTLM_SMOKE_SHOW_ELECTRON_LOGS || "").toLowerCase() === "1" ||
  String(process.env.INSIGHTLM_SMOKE_SHOW_ELECTRON_LOGS || "").toLowerCase() === "true";

function shouldPrintElectronLine(line) {
  const t = String(line || "");
  if (!t.trim()) return false;
  if (SHOW_ELECTRON_LOGS) return true;
  // High-signal only by default.
  return (
    t.includes("❌") ||
    t.includes("✅") ||
    t.includes("🎉") ||
    t.includes("[projects-proof]") ||
    t.includes("Project-scoped persistence proof") ||
    t.includes("Project A token") ||
    t.includes("Project B is isolated") ||
    t.includes("CDP did not come up") ||
    t.includes("Starting Electron") ||
    t.includes("Remote debugging enabled") ||
    t.startsWith("DevTools listening on ")
  );
}

function pipeElectronLogs(proc) {
  const handle = (buf, kind) => {
    const s = String(buf || "");
    for (const line of s.split(/\r?\n/)) {
      if (!shouldPrintElectronLine(line)) continue;
      const out = kind === "stderr" ? console.error : console.log;
      out(line);
    }
  };
  proc.stdout?.on("data", (d) => handle(d, "stdout"));
  proc.stderr?.on("data", (d) => handle(d, "stderr"));
}

async function isPortOpen() {
  try {
    const res = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/version`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function killExistingCDP9222IfElectron() {
  // Same safety approach as scripts/smoke-run.mjs: only auto-kill Electron.
  if (process.platform !== "win32") return;
  try {
    const { spawn } = await import("child_process");
    const runCapture = (cmd, args) =>
      new Promise((resolve) => {
        const p = spawn(cmd, args, { shell: true });
        let out = "";
        p.stdout?.on("data", (d) => (out += String(d)));
        p.on("close", (code) => resolve({ code: code ?? 1, out }));
        p.on("error", () => resolve({ code: 1, out }));
      });

    const net = await runCapture("cmd", ["/c", "netstat -ano | findstr :9222"]);
    if (net.code !== 0 || !String(net.out || "").trim()) return;

    const pids = Array.from(
      new Set(
        String(net.out || "")
          .split(/\r?\n/g)
          .map((l) => l.trim())
          .filter(Boolean)
          .filter((l) => /\bLISTENING\b/i.test(l))
          .map((l) => l.split(/\s+/g).pop())
          .filter((x) => /^\d+$/.test(String(x))),
      ),
    ).map((x) => Number(x));
    if (pids.length === 0) return;

    for (const pid of pids) {
      const tl = await runCapture("cmd", ["/c", `tasklist /FI "PID eq ${pid}" /FO CSV /NH`]);
      const line = String(tl.out || "").trim().split(/\r?\n/g).find((x) => x.trim()) || "";
      const img = line && line.startsWith('"') ? line.split('","')[0].replace(/^"/, "") : "";
      if (img.toLowerCase() !== "electron.exe") {
        console.error(
          `❌ CDP port 9222 is already in use by PID ${pid}${img ? ` (${img})` : ""}.\n` +
            `Close the process using port 9222 and re-run.`,
        );
        process.exit(2);
      }
      await runCmd("taskkill", ["/PID", String(pid), "/T", "/F"]);
    }
  } catch {
    // ignore
  }
}

async function waitForPort(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen()) return true;
    await sleep(500);
  }
  return false;
}

async function waitForExit(proc, timeoutMs = 30000) {
  if (!proc) return true;
  if (proc.exitCode != null) return true;
  return await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), timeoutMs);
    proc.once("exit", () => {
      clearTimeout(t);
      resolve(true);
    });
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

async function connectCDP() {
  const listUrl = `http://${CDP_HOST}:${CDP_PORT}/json/list`;
  const targets = await fetchJson(listUrl);
  const page =
    targets.find((t) => t.type === "page" && typeof t.webSocketDebuggerUrl === "string" && typeof t.url === "string" && !t.url.startsWith("devtools://")) ||
    targets.find((t) => typeof t.webSocketDebuggerUrl === "string");
  if (!page?.webSocketDebuggerUrl) throw new Error(`No CDP target found at ${listUrl}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  let id = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || "CDP error"));
      else resolve(msg.result);
    }
  });

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const evaluate = async (expression) => {
    const res = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (res?.exceptionDetails) throw new Error(res.exceptionDetails?.text || "Runtime.evaluate exception");
    return res?.result?.value;
  };

  await call("Runtime.enable");
  await call("Page.enable");
  return { ws, evaluate };
}

async function runProjectRelaunchProof(envBase) {
  // Proof: Project A persists across restart; Project B does not see A's draft.
  // We do NOT rely on in-app relaunch here (CDP can get disrupted); we control process lifetime.
  const projectA = String(envBase.INSIGHTLM_DATA_DIR || "").trim();
  if (!projectA) {
    console.warn("⚠️ Skipping project relaunch proof: INSIGHTLM_DATA_DIR not set");
    return true;
  }
  const projectB = `${projectA}-B-${Date.now()}`;
  const token = `proj_draft_${Date.now()}`;

  const runOne = async (dataDir, phase) => {
    const env = { ...envBase, INSIGHTLM_DATA_DIR: dataDir, INSIGHTLM_SMOKE_MINIMAL: "1" };
    const proc = spawn(electronPath, ["."], { stdio: ["ignore", "pipe", "pipe"], shell: false, env });
    pipeElectronLogs(proc);
    try {
      const ready = await waitForPort(120000);
      if (!ready) throw new Error("CDP did not come up in time");
      const { ws, evaluate } = await connectCDP();
      try {
        // Wait for project label to render
        await evaluate(`
          new Promise((resolve) => {
            const start = Date.now();
            const tick = () => {
              const el = document.querySelector('span[data-testid="sidebar-project-name"]');
              if (el && (el.innerText || "").trim()) return resolve(true);
              if (Date.now() - start > 20000) return resolve(false);
              setTimeout(tick, 150);
            };
            tick();
          })
        `);

        if (phase === "writeA") {
          await evaluate(`
            (async () => {
              if (!window.electronAPI?.chatDrafts?.setAll) throw new Error("electronAPI.chatDrafts unavailable");
              const draft = { text: ${JSON.stringify(token)}, refs: [], updatedAt: Date.now() };
              const res = await window.electronAPI.chatDrafts.setAll({ "sidebar:noctx": draft });
              if (!res || res.ok !== true) throw new Error("chatDrafts.setAll failed");
              const got = await window.electronAPI.chatDrafts.getAll();
              const txt = got?.drafts?.["sidebar:noctx"]?.text || "";
              return String(txt || "");
            })()
          `);
          const ok = await evaluate(`(async () => { const got = await window.electronAPI.chatDrafts.getAll(); return (got?.drafts?.["sidebar:noctx"]?.text || "") === ${JSON.stringify(token)}; })()`);
          if (!ok) throw new Error("Failed to write draft token in Project A (disk)");
        } else if (phase === "checkBAbsent") {
          const has = await evaluate(`(async () => { const got = await window.electronAPI.chatDrafts.getAll(); return (got?.drafts?.["sidebar:noctx"]?.text || "").includes(${JSON.stringify(token)}); })()`);
          if (has) throw new Error("Project B saw Project A token (not isolated)");
        } else if (phase === "checkAPresent") {
          // Poll briefly for storage to appear
          const ok = await evaluate(`
            new Promise((resolve) => {
              const start = Date.now();
              const tick = () => {
                (async () => {
                  try {
                    const got = await window.electronAPI.chatDrafts.getAll();
                    const txt = got?.drafts?.["sidebar:noctx"]?.text || "";
                    const has = String(txt || "") === ${JSON.stringify(token)};
                    if (has) return resolve(true);
                  } catch {}
                  if (Date.now() - start > 20000) return resolve(false);
                  setTimeout(tick, 250);
                })();
              };
              tick();
            })
          `);
          if (!ok) throw new Error("Project A token did not persist across restart");
        }
      } finally {
        try { ws.close(); } catch {}
      }
      // Disk-backed drafts do not require a graceful quit; force-kill is deterministic and avoids Windows quit hangs.
      console.log(`[projects-proof] Closing app process (${phase})...`);
      await killProcessTree(proc);
      return null;
    } catch (e) {
      await killProcessTree(proc);
      throw e;
    }
  };

  console.log(`⏭ Project relaunch proof (harness): A="${projectA}" → B="${projectB}" → A`);
  await runOne(projectA, "writeA");

  await runOne(projectB, "checkBAbsent");
  console.log("✅ Project B is isolated (did not see Project A token)");

  await runOne(projectA, "checkAPresent");
  console.log("✅ Project A token persisted across restart (A→B→A)");

  console.log("✅ Project-scoped persistence proof PASSED (harness)");
  return true;
}

function expandPathVars(p) {
  const raw = String(p || "").trim();
  if (!raw) return "";
  // Expand %VAR% on Windows (best-effort).
  return raw.replace(/%([A-Z0-9_]+)%/gi, (_m, v) => {
    const val = process.env[String(v || "").toUpperCase()] || process.env[String(v || "")] || "";
    return val ? String(val) : _m;
  });
}

function readSmokeDataDirFromConfig() {
  try {
    const cfgFile = String(process.env.INSIGHTLM_APP_CONFIG_FILE || "app.smoke.yaml").trim() || "app.smoke.yaml";
    const cfgPath = path.join(process.cwd(), "config", cfgFile);
    if (!fs.existsSync(cfgPath)) return "";
    const parsed = yaml.load(fs.readFileSync(cfgPath, "utf-8"));
    const dataDir = typeof parsed?.dataDir === "string" ? parsed.dataDir : "";
    return expandPathVars(dataDir);
  } catch {
    return "";
  }
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
    p.on("close", (code) => resolve(code ?? 1));
    p.on("error", reject);
  });
}

async function killProcessTree(proc) {
  try {
    if (!proc || proc.killed) return;
    const pid = proc.pid;
    if (!pid) {
      try {
        proc.kill();
      } catch {}
      return;
    }
    if (process.platform === "win32") {
      // Kill the entire process tree; Electron often leaves child processes that keep files locked.
      await runCmd("taskkill", ["/PID", String(pid), "/T", "/F"]);
      return;
    }
    // Best-effort non-Windows
    try {
      proc.kill("SIGTERM");
    } catch {}
    await sleep(500);
    try {
      if (!proc.killed) proc.kill("SIGKILL");
    } catch {}
  } catch {
    // ignore
  }
}

async function main() {
  await killExistingCDP9222IfElectron();

  // Build first (ensures dist/ and dist-electron/ are up to date)
  const buildCode = await runCmd("npm", ["run", "build"]);
  if (buildCode !== 0) process.exit(buildCode);

  // Launch Electron in "prod renderer" mode (loads dist/index.html even though not packaged)
  const env = {
    ...process.env,
    INSIGHTLM_FORCE_PROD_UI: "1",
    // Run smoke in the dedicated smoke dataDir (config/app.smoke.yaml),
    // so automation doesn't pollute a developer's normal dev data folder.
    INSIGHTLM_APP_CONFIG_FILE: process.env.INSIGHTLM_APP_CONFIG_FILE || "app.smoke.yaml",
    // Prevent stale persisted tabs from trying to open deleted smoke artifacts on boot.
    INSIGHTLM_CLEAN_TABS_ON_START: "1",
    NODE_ENV: "production",
  };

  // Project-scoped persistence proof (restart-level) before full UI smoke.
  // Use the configured smoke dataDir as Project A.
  const projectA = String(process.env.INSIGHTLM_DATA_DIR || "").trim() || readSmokeDataDirFromConfig();
  await runProjectRelaunchProof({ ...env, INSIGHTLM_DATA_DIR: projectA });

  console.log("Starting Electron (prod renderer mode)...");
  // Spawn the Electron binary directly (avoid npx/cmd wrappers so we can reliably kill the process tree on Windows).
  const electronProc = spawn(electronPath, ["."], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env,
  });
  pipeElectronLogs(electronProc);

  try {
    // On some Windows machines, Electron + extensions + MCP discovery can take >60s before CDP responds.
    const ready = await waitForPort(120000);
    if (!ready) {
      console.error(`❌ CDP did not come up on ${CDP_HOST}:${CDP_PORT} in time.`);
      process.exit(1);
    }

    const smokeCode = await runCmd("npm", ["run", "test:automation:smoke"], {
      env: { ...process.env, ELECTRON_DEBUG_HOST: CDP_HOST, ELECTRON_DEBUG_PORT: String(CDP_PORT) },
    });
    process.exit(smokeCode);
  } finally {
    await killProcessTree(electronProc);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
