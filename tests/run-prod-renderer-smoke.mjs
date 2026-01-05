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

const CDP_HOST = "127.0.0.1";
const CDP_PORT = 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isPortOpen() {
  try {
    const res = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/version`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
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
  if (await isPortOpen()) {
    console.error(`❌ CDP is already reachable on ${CDP_HOST}:${CDP_PORT}. Close any running insightLM-LT instance first.`);
    process.exit(2);
  }

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

  console.log("Starting Electron (prod renderer mode)...");
  // Spawn the Electron binary directly (avoid npx/cmd wrappers so we can reliably kill the process tree on Windows).
  const electronProc = spawn(electronPath, ["."], {
    stdio: "inherit",
    shell: false,
    env,
  });

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
