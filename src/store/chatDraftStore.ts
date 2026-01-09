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
  getDraft: (draftKey: string) => ChatDraft | null;
  setDraft: (draftKey: string, draft: Omit<ChatDraft, "updatedAt">) => void;
  clearDraft: (draftKey: string) => void;
};

const STORAGE_KEY = "insightlm.chatDrafts.v1";

function loadDrafts(): Record<string, ChatDraft> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, ChatDraft>;
  } catch {
    return {};
  }
}

function saveDrafts(drafts: Record<string, ChatDraft>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // ignore
  }
}

export const useChatDraftStore = create<ChatDraftStore>((set, get) => ({
  drafts: loadDrafts(),
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
      saveDrafts(next);
      return { drafts: next };
    });
  },
  clearDraft: (draftKey) => {
    const k = String(draftKey || "");
    if (!k) return;
    set((state) => {
      const next = { ...(state.drafts || {}) };
      delete next[k];
      saveDrafts(next);
      return { drafts: next };
    });
  },
}));

