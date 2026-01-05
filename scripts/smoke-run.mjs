#!/usr/bin/env node
/**
 * smoke:run
 * - wipes the smoke dataDir (config/app.smoke.yaml)
 * - runs the prod renderer + CDP smoke
 * - wipes smoke dataDir again (so you don't accumulate smoke artifacts)
 */
import { spawn } from "child_process";

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
    p.on("close", (code) => resolve(code ?? 1));
    p.on("error", () => resolve(1));
  });
}

function runCapture(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { shell: process.platform === "win32", ...opts });
    let out = "";
    let err = "";
    p.stdout?.on("data", (d) => (out += String(d)));
    p.stderr?.on("data", (d) => (err += String(d)));
    p.on("close", (code) => resolve({ code: code ?? 1, out, err }));
    p.on("error", () => resolve({ code: 1, out, err }));
  });
}

async function killExistingCDP9222IfElectron() {
  // Best practice: don't blindly kill unknown processes.
  // For smoke runs we can safely kill *Electron* instances holding CDP 9222, because they will lock the smoke workspace.
  if (process.platform !== "win32") return;

  const net = await runCapture("cmd", ["/c", "netstat -ano | findstr :9222"]);
  if (net.code !== 0 || !net.out.trim()) return;

  const pids = Array.from(
    new Set(
      net.out
        .split(/\r?\n/g)
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => /\bLISTENING\b/i.test(l))
        .map((l) => {
          const parts = l.split(/\s+/g);
          return parts[parts.length - 1];
        })
        .filter((x) => /^\d+$/.test(String(x))),
    ),
  ).map((x) => Number(x));

  if (pids.length === 0) return;

  for (const pid of pids) {
    const tl = await runCapture("cmd", ["/c", `tasklist /FI "PID eq ${pid}" /FO CSV /NH`]);
    const line = (tl.out || "").trim().split(/\r?\n/g).find((x) => x.trim());
    // Expected CSV format: "Image Name","PID",...
    const img = line && line.startsWith('"') ? line.split('","')[0].replace(/^"/, "") : "";
    if (img.toLowerCase() !== "electron.exe") {
      console.error(
        `❌ CDP port 9222 is already in use by PID ${pid}${img ? ` (${img})` : ""}.\n` +
          `For safety, smoke:run only auto-kills Electron.\n` +
          `Close the process using port 9222 and re-run.`,
      );
      process.exit(2);
    }

    await run("taskkill", ["/PID", String(pid), "/T", "/F"]);
  }
}

async function main() {
  await killExistingCDP9222IfElectron();

  const reset1 = await run("node", ["scripts/reset-data.mjs", "--config", "app.smoke.yaml", "--quiet"]);
  if (reset1 !== 0) process.exit(reset1);

  const testCode = await run("npm", ["run", "test:automation:prod"]);

  // Always attempt a cleanup, even if the smoke failed.
  await run("node", ["scripts/reset-data.mjs", "--config", "app.smoke.yaml", "--quiet"]);
  process.exit(testCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
