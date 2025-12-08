import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  workbookId?: string; // Optional - link to workbook
  messages: ChatMessage[];
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
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.currentSessionId = session.id;
    this.saveSession(session);
    return session;
  }

  saveMessage(sessionId: string, role: "user" | "assistant", content: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    session.updatedAt = new Date().toISOString();
    this.saveSession(session);
  }

  getSession(sessionId: string): ChatSession | null {
    const sessionPath = path.join(this.chatsDir, `${sessionId}.json`);
    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(sessionPath, "utf-8");
      return JSON.parse(content) as ChatSession;
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
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
          const session = JSON.parse(content) as ChatSession;
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
}
















