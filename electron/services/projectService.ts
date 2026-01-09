import { app, dialog } from "electron";
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
  const h = createHash("sha1").update(String(dataDir || "")).digest("hex").slice(0, 10);
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

  relaunchIntoProject(dataDir: string) {
    const dir = String(dataDir || "").trim();
    if (!dir) return;
    this.ensureProjectLayout(dir);
    this.touchRecent(dir);

    // Relaunch with an argv override. On startup we parse --dataDir=... and set INSIGHTLM_DATA_DIR.
    const arg = `--dataDir=${dir}`;
    const args = (process.argv || []).filter((a) => !String(a).startsWith("--dataDir="));
    args.push(arg);
    app.relaunch({ args });
    app.exit(0);
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

