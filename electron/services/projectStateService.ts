import * as fs from "fs";
import * as path from "path";
import type { ConfigService } from "./configService";

export type PersistedTabIdentity =
  | { type: "chat"; chatKey: string }
  | { type: "document"; workbookId: string; path: string }
  | { type: "dashboard"; dashboardId: string }
  | { type: "config"; configKey: string };

export type ProjectUIStateV1 = {
  version: 1;
  scopeMode?: "all" | "context";
  activeTab?: PersistedTabIdentity | null;
};

const STATE_FILE = "project-ui-state.v1.json";

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function normalizeTabIdentity(x: any): PersistedTabIdentity | null {
  try {
    const t = String(x?.type || "").trim();
    if (t === "chat") {
      const chatKey = String(x?.chatKey || "main").trim() || "main";
      return { type: "chat", chatKey };
    }
    if (t === "document") {
      const workbookId = String(x?.workbookId || "").trim();
      const p = String(x?.path || "").trim();
      if (!workbookId || !p) return null;
      return { type: "document", workbookId, path: p };
    }
    if (t === "dashboard") {
      const dashboardId = String(x?.dashboardId || "").trim();
      if (!dashboardId) return null;
      return { type: "dashboard", dashboardId };
    }
    if (t === "config") {
      const configKey = String(x?.configKey || "").trim();
      if (!configKey) return null;
      return { type: "config", configKey };
    }
    return null;
  } catch {
    return null;
  }
}

export class ProjectStateService {
  constructor(private configService: ConfigService) {}

  private getStatePath(): string {
    const dataDir = this.configService.loadAppConfig().dataDir;
    return path.join(String(dataDir || ""), "config", STATE_FILE);
  }

  get(): ProjectUIStateV1 {
    try {
      const p = this.getStatePath();
      if (!fs.existsSync(p)) return { version: 1, scopeMode: "context", activeTab: null };
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw);
      const scopeMode =
        parsed?.scopeMode === "all" || parsed?.scopeMode === "context" ? parsed.scopeMode : "context";
      const activeTab = normalizeTabIdentity(parsed?.activeTab);
      return { version: 1, scopeMode, activeTab };
    } catch {
      return { version: 1, scopeMode: "context", activeTab: null };
    }
  }

  set(partial: Partial<ProjectUIStateV1>): ProjectUIStateV1 {
    const current = this.get();
    const next: ProjectUIStateV1 = { ...current, version: 1 };
    if (partial.scopeMode === "all" || partial.scopeMode === "context") {
      next.scopeMode = partial.scopeMode;
    }
    if (partial.activeTab === null) {
      next.activeTab = null;
    } else if (partial.activeTab !== undefined) {
      next.activeTab = normalizeTabIdentity(partial.activeTab);
    }

    try {
      const p = this.getStatePath();
      ensureDir(path.dirname(p));
      fs.writeFileSync(p, JSON.stringify(next, null, 2), "utf-8");
    } catch {
      // ignore (fail-soft)
    }
    return next;
  }
}

