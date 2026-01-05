#!/usr/bin/env node
/**
 * Cross-platform Electron launcher that pins INSIGHTLM_APP_CONFIG_FILE without shell-specific syntax.
 *
 * Examples:
 *   node scripts/run-electron.mjs --config app.dev.yaml
 *   node scripts/run-electron.mjs --config app.smoke.yaml -- --remote-debugging-port=9223
 */
import { spawn } from "child_process";

function parseArgs(argv) {
  const out = { config: "", extra: [] };
  const args = [...argv];
  while (args.length) {
    const a = args.shift();
    if (a === "--config") {
      out.config = String(args.shift() || "");
      continue;
    }
    if (a === "--") {
      out.extra = args.splice(0);
      break;
    }
    // ignore unknown flags for now
  }
  return out;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
    p.on("close", (code) => resolve(code ?? 1));
    p.on("error", () => resolve(1));
  });
}

async function main() {
  const { config, extra } = parseArgs(process.argv.slice(2));

  const env = { ...process.env };
  if (config && config.trim()) {
    env.INSIGHTLM_APP_CONFIG_FILE = config.trim();
  }

  // Compile Electron main process first (fast path).
  const buildCode = await run("npm", ["run", "build:electron"]);
  if (buildCode !== 0) process.exit(buildCode);

  const electronArgs = [".", ...extra];
  const code = await run("electron", electronArgs, { env });
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
