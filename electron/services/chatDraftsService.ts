import * as fs from "fs";
import * as path from "path";

export type ChatDraftRef = {
  key: string;
  displayLabel: string;
  fullLabel: string;
  insertText: string;
  kind: string;
};

export type ChatDraft = {
  text: string;
  refs: ChatDraftRef[];
  updatedAt: number;
};

export type ChatDraftsFile = {
  version: 1;
  drafts: Record<string, ChatDraft>;
};

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export class ChatDraftsService {
  constructor(private projectDataDir: string) {}

  private filePath(): string {
    return path.join(this.projectDataDir, "chats", "chatDrafts.v1.json");
  }

  readAll(): Record<string, ChatDraft> {
    try {
      const fp = this.filePath();
      if (!fs.existsSync(fp)) return {};
      const raw = fs.readFileSync(fp, "utf-8");
      const parsed = safeJsonParse(raw);
      const drafts = parsed?.drafts;
      if (!drafts || typeof drafts !== "object") return {};
      return drafts as Record<string, ChatDraft>;
    } catch {
      return {};
    }
  }

  writeAll(drafts: Record<string, ChatDraft>) {
    const fp = this.filePath();
    ensureDir(path.dirname(fp));
    const payload: ChatDraftsFile = { version: 1, drafts: drafts || {} };
    const tmp = fp + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf-8");
    fs.renameSync(tmp, fp);
  }
}

