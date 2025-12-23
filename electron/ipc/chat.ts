import { ipcMain } from "electron";
import { ChatService } from "../services/chatService";

function toSessionId(contextId: string): string {
  // Deterministic, filesystem-safe session id derived from context id.
  const raw = String(contextId || "").trim();
  if (!raw) return "context-unknown";
  return `context-${raw.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

export function setupChatIPC(chatService: ChatService) {
  ipcMain.handle("chat:getThread", async (_evt, contextId: string) => {
    const sessionId = toSessionId(contextId);
    const session = chatService.getOrCreateSession(sessionId, { contextId });
    return { sessionId: session.id, contextId, messages: session.messages || [] };
  });

  ipcMain.handle(
    "chat:append",
    async (_evt, params: { contextId: string; role: "user" | "assistant"; content: string; meta?: any }) => {
      const contextId = String(params?.contextId || "");
      const role = params?.role;
      const content = String(params?.content || "");
      const messageMeta = params?.meta && typeof params.meta === "object" ? params.meta : undefined;
      const sessionId = toSessionId(contextId);

      if (role !== "user" && role !== "assistant") {
        throw new Error("Invalid chat role");
      }

      const msg = chatService.appendMessage(sessionId, role, content, { contextId, messageMeta });
      return { message: msg };
    },
  );

  ipcMain.handle("chat:clear", async (_evt, contextId: string) => {
    const sessionId = toSessionId(contextId);
    chatService.clearSession(sessionId);
    // Recreate empty session so UI doesn't race on missing file
    const session = chatService.getOrCreateSession(sessionId, { contextId });
    return { sessionId: session.id, contextId, messages: session.messages || [] };
  });
}
