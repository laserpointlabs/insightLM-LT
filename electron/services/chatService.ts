import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  seq: number;
}

export interface ChatSession {
  id: string;
  workbookId?: string; // Optional - link to workbook
  contextId?: string;
  messages: ChatMessage[];
  nextSeq: number;
  createdAt: string;
  updatedAt: string;
}

export class ChatService {
  private chatsDir: string = "";
  private currentSessionId: string | null = null;

  initialize(dataDir: string) {
    this.chatsDir = path.join(dataDir, "chats");
    this.ensureDirectoryExists(this.chatsDir);
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  createSession(workbookId?: string): ChatSession {
    const session: ChatSession = {
      id: uuidv4(),
      workbookId,
      contextId: undefined,
      messages: [],
      nextSeq: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.currentSessionId = session.id;
    this.saveSession(session);
    return session;
  }

  /**
   * Deterministic (stable) session retrieval by id.
   * If missing, creates a new session with that id (used for single-thread-per-context chat).
   */
  getOrCreateSession(sessionId: string, meta?: { workbookId?: string; contextId?: string }): ChatSession {
    const existing = this.getSession(sessionId);
    if (existing) return this.migrateSession(existing);

    const now = new Date().toISOString();
    const session: ChatSession = {
      id: sessionId,
      workbookId: meta?.workbookId,
      contextId: meta?.contextId,
      messages: [],
      nextSeq: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.saveSession(session);
    return session;
  }

  appendMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    meta?: { workbookId?: string; contextId?: string },
  ): ChatMessage {
    const session = this.getOrCreateSession(sessionId, meta);
    const msg: ChatMessage = {
      id: `m${session.nextSeq}`,
      seq: session.nextSeq,
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    session.nextSeq += 1;
    session.updatedAt = new Date().toISOString();
    session.messages.push(msg);
    this.saveSession(session);
    return msg;
  }

  getSession(sessionId: string): ChatSession | null {
    const sessionPath = path.join(this.chatsDir, `${sessionId}.json`);
    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(sessionPath, "utf-8");
      const parsed = JSON.parse(content) as ChatSession;
      return this.migrateSession(parsed);
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  private migrateSession(session: ChatSession): ChatSession {
    // Back-compat for older session files.
    if (!Array.isArray(session.messages)) session.messages = [];
    if (typeof (session as any).nextSeq !== "number" || !Number.isFinite((session as any).nextSeq)) {
      session.nextSeq = 1;
    }

    // Ensure deterministic seq/id exists per message.
    let maxSeq = 0;
    session.messages = session.messages.map((m: any, idx: number) => {
      const seq = typeof m?.seq === "number" && Number.isFinite(m.seq) ? m.seq : idx + 1;
      const id = typeof m?.id === "string" && m.id.trim() ? m.id : `m${seq}`;
      const timestamp = typeof m?.timestamp === "string" ? m.timestamp : new Date().toISOString();
      maxSeq = Math.max(maxSeq, seq);
      return {
        id,
        seq,
        role: m?.role === "assistant" || m?.role === "system" ? m.role : "user",
        content: typeof m?.content === "string" ? m.content : String(m?.content ?? ""),
        timestamp,
      } as ChatMessage;
    });

    // Keep ordering deterministic.
    session.messages.sort((a, b) => a.seq - b.seq);

    // Ensure nextSeq is strictly greater than max.
    if (session.nextSeq <= maxSeq) session.nextSeq = maxSeq + 1;

    return session;
  }

  private saveSession(session: ChatSession): void {
    const sessionPath = path.join(this.chatsDir, `${session.id}.json`);
    try {
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error(`Failed to save session ${session.id}:`, error);
      throw error;
    }
  }

  getAllSessions(): ChatSession[] {
    if (!fs.existsSync(this.chatsDir)) {
      return [];
    }

    const sessions: ChatSession[] = [];
    const files = fs.readdirSync(this.chatsDir);

    for (const file of files) {
      if (file.endsWith(".json")) {
        const sessionPath = path.join(this.chatsDir, file);
        try {
          const content = fs.readFileSync(sessionPath, "utf-8");
          const session = this.migrateSession(JSON.parse(content) as ChatSession);
          sessions.push(session);
        } catch (error) {
          console.error(`Failed to load session from ${file}:`, error);
        }
      }
    }

    // Sort by updatedAt descending (most recent first)
    return sessions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  deleteSession(sessionId: string): void {
    const sessionPath = path.join(this.chatsDir, `${sessionId}.json`);
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }
  }

  clearSession(sessionId: string): void {
    // Delete file if exists (used for "New Chat")
    this.deleteSession(sessionId);
  }
}
