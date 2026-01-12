import { ipcMain } from "electron";
import type { ConfigService } from "../services/configService";
import { ChatDraftsService, type ChatDraft } from "../services/chatDraftsService";

export function setupChatDraftsIPC(configService: ConfigService) {
  const svc = () => new ChatDraftsService(configService.loadAppConfig().dataDir);

  ipcMain.handle("chatDrafts:getAll", async () => {
    try {
      return { ok: true, drafts: svc().readAll() };
    } catch (e) {
      return { ok: false, drafts: {}, error: e instanceof Error ? e.message : "Failed to load chat drafts" };
    }
  });

  ipcMain.handle("chatDrafts:setAll", async (_evt, drafts: Record<string, ChatDraft>) => {
    try {
      svc().writeAll(drafts || {});
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed to save chat drafts" };
    }
  });
}

