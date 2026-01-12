import { create } from "zustand";

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

type ChatDraftStore = {
  drafts: Record<string, ChatDraft>;
  hydrate: (drafts: Record<string, ChatDraft>) => void;
  ensureLoaded: () => Promise<void>;
  getDraft: (draftKey: string) => ChatDraft | null;
  setDraft: (draftKey: string, draft: Omit<ChatDraft, "updatedAt">) => void;
  clearDraft: (draftKey: string) => void;
};

let saveTimer: any = null;
let loadedOnce = false;
let loadInFlight: Promise<void> | null = null;

function scheduleSaveToDisk(drafts: Record<string, ChatDraft>) {
  try {
    if (!window.electronAPI?.chatDrafts?.setAll) return;
    if (saveTimer) clearTimeout(saveTimer);
    // Debounce to avoid IPC spam while typing.
    saveTimer = setTimeout(() => {
      try {
        window.electronAPI.chatDrafts.setAll(drafts).catch(() => {});
      } catch {
        // ignore
      }
    }, 250);
  } catch {
    // ignore
  }
}

export const useChatDraftStore = create<ChatDraftStore>((set, get) => ({
  drafts: {},
  hydrate: (drafts) => {
    set({ drafts: drafts || {} });
  },
  ensureLoaded: async () => {
    if (loadedOnce) return;
    if (loadInFlight) return await loadInFlight;
    loadInFlight = (async () => {
      try {
        const res = await window.electronAPI?.chatDrafts?.getAll?.();
        const drafts = res?.ok ? res?.drafts : {};
        set({ drafts: drafts && typeof drafts === "object" ? drafts : {} });
      } catch {
        // ignore
      } finally {
        loadedOnce = true;
        loadInFlight = null;
      }
    })();
    return await loadInFlight;
  },
  getDraft: (draftKey) => {
    const k = String(draftKey || "");
    if (!k) return null;
    const d = get().drafts[k];
    if (!d || typeof d !== "object") return null;
    return d;
  },
  setDraft: (draftKey, draft) => {
    const k = String(draftKey || "");
    if (!k) return;
    set((state) => {
      const next: Record<string, ChatDraft> = {
        ...(state.drafts || {}),
        [k]: {
          text: String(draft?.text || ""),
          refs: Array.isArray(draft?.refs) ? draft.refs : [],
          updatedAt: Date.now(),
        },
      };
      scheduleSaveToDisk(next);
      return { drafts: next };
    });
  },
  clearDraft: (draftKey) => {
    const k = String(draftKey || "");
    if (!k) return;
    set((state) => {
      const next = { ...(state.drafts || {}) };
      delete next[k];
      scheduleSaveToDisk(next);
      return { drafts: next };
    });
  },
}));

