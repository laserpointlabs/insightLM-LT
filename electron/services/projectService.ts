import { app, dialog, BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import type { ConfigService } from "./configService";

export type ProjectInfo = {
  dataDir: string;
  name: string;
  lastOpenedAt: number;
};

type ProjectsState = {
  version: 1;
  recents: ProjectInfo[];
};

const PROJECTS_STATE_FILE = "projects.v1.json";

function sanitizeName(name: string): string {
  const raw = String(name || "").trim();
  if (!raw) return "Project";
  return raw.slice(0, 80);
}

function computeProjectId(dataDir: string): string {
  // Short, stable id; avoid long hashes.
  // IMPORTANT: normalize path so Windows separator/case differences don't create different partitions.
  let norm = String(dataDir || "").trim();
  try {
    norm = path.resolve(norm);
  } catch {
    // ignore
  }
  norm = norm.replace(/\\/g, "/").replace(/\/+$/g, "");
  if (process.platform === "win32") norm = norm.toLowerCase();

  const h = createHash("sha1").update(norm).digest("hex").slice(0, 10);
  return h;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export class ProjectService {
  constructor(private configService: ConfigService) {}

  getCurrentDataDir(): string {
    return this.configService.loadAppConfig().dataDir;
  }

  getCurrentProjectId(): string {
    return computeProjectId(this.getCurrentDataDir());
  }

  private getStatePath(): string {
    return path.join(app.getPath("userData"), PROJECTS_STATE_FILE);
  }

  private loadState(): ProjectsState {
    try {
      const p = this.getStatePath();
      if (!fs.existsSync(p)) return { version: 1, recents: [] };
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw);
      const recents = Array.isArray(parsed?.recents) ? parsed.recents : [];
      return {
        version: 1,
        recents: recents
          .map((r: any) => ({
            dataDir: String(r?.dataDir || ""),
            name: sanitizeName(r?.name || path.basename(String(r?.dataDir || "")) || "Project"),
            lastOpenedAt: Number(r?.lastOpenedAt || 0) || 0,
          }))
          .filter((r: ProjectInfo) => !!r.dataDir),
      };
    } catch {
      return { version: 1, recents: [] };
    }
  }

  private saveState(state: ProjectsState) {
    try {
      const p = this.getStatePath();
      ensureDir(path.dirname(p));
      fs.writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
    } catch {
      // ignore
    }
  }

  listRecents(): ProjectInfo[] {
    const st = this.loadState();
    const recents = Array.isArray(st.recents) ? st.recents : [];
    recents.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
    return recents.slice(0, 12);
  }

  touchRecent(dataDir: string) {
    const dir = String(dataDir || "").trim();
    if (!dir) return;
    const name = sanitizeName(path.basename(dir) || "Project");
    const now = Date.now();
    const st = this.loadState();
    const existingIdx = st.recents.findIndex((r) => r.dataDir === dir);
    if (existingIdx >= 0) {
      st.recents[existingIdx] = { ...st.recents[existingIdx], lastOpenedAt: now, name };
    } else {
      st.recents.unshift({ dataDir: dir, name, lastOpenedAt: now });
    }
    // Dedup + cap.
    const seen = new Set<string>();
    st.recents = st.recents.filter((r) => {
      if (!r.dataDir) return false;
      if (seen.has(r.dataDir)) return false;
      seen.add(r.dataDir);
      return true;
    });
    st.recents = st.recents.slice(0, 30);
    this.saveState(st);
  }

  ensureProjectLayout(dataDir: string) {
    const dir = String(dataDir || "").trim();
    if (!dir) throw new Error("Invalid project dataDir");
    ensureDir(dir);
    ensureDir(path.join(dir, "workbooks"));
    ensureDir(path.join(dir, "dashboards"));
    ensureDir(path.join(dir, "chats"));
    ensureDir(path.join(dir, "config"));
    ensureDir(path.join(dir, "contexts"));
  }

  async pickProjectDirectory(kind: "new" | "open"): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: kind === "new" ? "New Project (Choose a folder)" : "Open Project (Choose a folder)",
      properties: kind === "new" ? ["openDirectory", "createDirectory"] : ["openDirectory"],
    });
    if (result.canceled) return null;
    const p = Array.isArray(result.filePaths) ? result.filePaths[0] : null;
    return p ? String(p) : null;
  }

  async relaunchIntoProject(dataDir: string) {
    const dir = String(dataDir || "").trim();
    if (!dir) return;
    this.ensureProjectLayout(dir);
    this.touchRecent(dir);

    // Relaunch with an argv override. On startup we parse --dataDir=... and set INSIGHTLM_DATA_DIR.
    const arg = `--dataDir=${dir}`;
    // IMPORTANT (Windows): app.relaunch({ args }) expects args *excluding* the executable path.
    // If we include argv[0] (electron.exe), the relaunched instance will try to load electron.exe as the app
    // and crash with ERR_UNKNOWN_FILE_EXTENSION ".exe".
    const args = (process.argv || [])
      .slice(1)
      .filter((a) => !String(a).startsWith("--dataDir="));
    args.push(arg);
    // Best-effort: flush renderer storage before exiting so drafts/tabs persist deterministically.
    // Without this, fast relaunch can lose last-moment localStorage writes (LevelDB flush timing).
    try {
      const wins = BrowserWindow.getAllWindows();
      await Promise.allSettled(
        wins.map(async (w) => {
          try {
            await w.webContents?.session?.flushStorageData?.();
          } catch {
            // ignore
          }
        }),
      );
    } catch {
      // ignore
    }

    app.relaunch({ args });

    // Graceful quit so Chromium has a chance to persist partition storage.
    try {
      for (const w of BrowserWindow.getAllWindows()) {
        try {
          w.close();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    setTimeout(() => {
      try {
        app.quit();
      } catch {
        // ignore
      }
    }, 50);
  }
}

export function parseDataDirArg(argv: string[]): string | null {
  const args = Array.isArray(argv) ? argv : [];
  const hit = args.find((a) => String(a).startsWith("--dataDir="));
  if (!hit) return null;
  const v = String(hit).slice("--dataDir=".length).trim();
  return v || null;
}

export function projectPartitionIdFromDataDir(dataDir: string): string {
  return `persist:insightlm-project-${computeProjectId(dataDir)}`;
}
