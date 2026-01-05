#!/usr/bin/env node
/**
 * dev:clean
 * - wipes the dev dataDir (config/app.dev.yaml)
 * - starts normal dev (Electron + React)
 *
 * This keeps your real workspace clean while still letting you run demos via Demos menu.
 */
import { spawn } from "child_process";

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
    p.on("close", (code) => resolve(code ?? 1));
    p.on("error", () => resolve(1));
  });
}

async function main() {
  const resetCode = await run("node", ["scripts/reset-data.mjs", "--config", "app.dev.yaml"]);
  if (resetCode !== 0) process.exit(resetCode);

  const devCode = await run("npm", ["run", "dev"]);
  process.exit(devCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
