#!/usr/bin/env node
/**
 * Reset an InsightLM-LT dataDir based on a config file (e.g. app.dev.yaml).
 * Cross-platform (Node), avoids shell-specific env var syntax.
 *
 * Usage:
 *   node scripts/reset-data.mjs --config app.dev.yaml
 *   node scripts/reset-data.mjs --config app.smoke.yaml --quiet
 *
 * Notes:
 * - Deletes only known app state folders under dataDir:
 *   workbooks, dashboards, contexts, chats, rag_db, .seed
 * - Recreates the core folders (workbooks, dashboards, contexts, chats)
 */
import fs from "fs";
import path from "path";
import process from "process";
import yaml from "js-yaml";

function parseArgs(argv) {
  const out = { config: "", quiet: false };
  const args = [...argv];
  while (args.length) {
    const a = args.shift();
    if (a === "--config") {
      out.config = String(args.shift() || "");
      continue;
    }
    if (a === "--quiet") {
      out.quiet = true;
      continue;
    }
  }
  return out;
}

function expandEnvVars(str) {
  return String(str || "").replace(/\$\{(\w+)\}/g, (_m, name) => process.env[name] || _m);
}

function expandPath(p) {
  const expanded = expandEnvVars(p);
  if (expanded.includes("%APPDATA%")) {
    const appData =
      process.env.APPDATA ||
      (process.platform === "win32"
        ? path.join(process.env.USERPROFILE || "", "AppData", "Roaming")
        : path.join(process.env.HOME || "", ".config"));
    return expanded.replace("%APPDATA%", appData);
  }
  return expanded;
}

function configDir() {
  // dev uses repo ./config; packaged uses resources/config
  const project = path.join(process.cwd(), "config");
  if (fs.existsSync(project)) return project;
  if (process.resourcesPath) return path.join(process.resourcesPath, "config");
  return project;
}

function log(quiet, ...args) {
  if (!quiet) console.log(...args);
}

function rmWithRetries(targetPath, quiet, attempts = 6) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      if (!fs.existsSync(targetPath)) return { ok: true };
      fs.rmSync(targetPath, { recursive: true, force: true });
      if (!fs.existsSync(targetPath)) return { ok: true };
    } catch (e) {
      lastErr = e;
      const code = e?.code || "";
      // Common Windows transient locks: EBUSY/EPERM. Backoff a bit.
      if (code === "EBUSY" || code === "EPERM") {
        // Keep it simple + predictable: short busy-wait backoff (avoids async timing + tool hangs).
        const ms = 80 + i * 120;
        const end = Date.now() + ms;
        while (Date.now() < end) {
          // spin
        }
        continue;
      }
      break;
    }
  }
  return { ok: false, error: lastErr };
}

async function main() {
  const { config, quiet } = parseArgs(process.argv.slice(2));
  const cfgFile = (config && config.trim()) || "app.dev.yaml";
  const cfgPath = path.join(configDir(), cfgFile);

  if (!fs.existsSync(cfgPath)) {
    console.error(`❌ Config not found: ${cfgPath}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(cfgPath, "utf-8");
  const parsed = yaml.load(raw) || {};
  const dataDirRaw = typeof parsed.dataDir === "string" ? parsed.dataDir : "";
  const dataDir = expandPath((dataDirRaw || "").trim());

  if (!dataDir) {
    console.error(`❌ dataDir is empty in ${cfgPath}`);
    process.exit(2);
  }

  const toDelete = ["workbooks", "dashboards", "contexts", "chats", "rag_db", ".seed"];
  const toRecreate = ["workbooks", "dashboards", "contexts", "chats"];

  log(quiet, `🧹 Resetting dataDir (from ${cfgFile}): ${dataDir}`);

  const failures = [];
  for (const name of toDelete) {
    const p = path.join(dataDir, name);
    const res = rmWithRetries(p, quiet);
    if (res.ok) {
      if (fs.existsSync(p)) {
        // should not happen, but keep it explicit
        failures.push({ name, path: p, error: new Error("Path still exists after delete") });
      } else {
        if (!quiet && fs.existsSync(p) === false) {
          log(quiet, `  - deleted ${name}`);
        }
      }
    } else {
      failures.push({ name, path: p, error: res.error });
      console.warn(`⚠️ Failed to delete ${p}:`, res.error?.message || res.error);
    }
  }

  for (const name of toRecreate) {
    try {
      fs.mkdirSync(path.join(dataDir, name), { recursive: true });
    } catch {}
  }

  // Ensure core "index" files exist so the app doesn't log noisy ENOENT warnings on first read.
  try {
    const dashboardsFile = path.join(dataDir, "dashboards", "dashboards.json");
    if (!fs.existsSync(dashboardsFile)) {
      fs.writeFileSync(dashboardsFile, JSON.stringify([], null, 2), "utf-8");
    }
  } catch {}

  if (failures.length) {
    console.error(
      `❌ Reset incomplete (${failures.length} paths could not be deleted).\n` +
      `Close InsightLM-LT (and any tools watching this folder) and re-run.`
    );
    process.exit(3);
  }

  log(quiet, "✅ Reset complete");
}

main().catch((e) => {
  console.error("❌ reset-data failed:", e?.message || e);
  process.exit(1);
});
