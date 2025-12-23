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
    NODE_ENV: "production",
  };

  console.log("Starting Electron (prod renderer mode)...");
  const electronProc = spawn("npx", ["electron", "."], {
    stdio: "inherit",
    shell: process.platform === "win32",
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
    try {
      if (!electronProc.killed) electronProc.kill();
    } catch {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
