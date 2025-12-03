import { create } from "zustand";

export type SidebarView = "workbooks" | "chat" | "dashboard";

interface LayoutStore {
  sidebarWidth: number; // Width of left sidebar in pixels
  chatHeight: number; // Height of chat area in pixels (from bottom)
  activeSidebarView: SidebarView; // Active view in the sidebar

  setSidebarWidth: (width: number) => void;
  setChatHeight: (height: number) => void;
  setActiveSidebarView: (view: SidebarView) => void;
  resetLayout: () => void;
}

const DEFAULT_SIDEBAR_WIDTH = 256; // 64 * 4 = 256px (w-64)
const DEFAULT_CHAT_HEIGHT = 256; // 64 * 4 = 256px (h-64)

const STORAGE_KEY = "insightlm-layout-storage";

// Load from localStorage
const loadLayout = (): { sidebarWidth: number; chatHeight: number; activeSidebarView: SidebarView } => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        sidebarWidth: parsed.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
        chatHeight: parsed.chatHeight ?? DEFAULT_CHAT_HEIGHT,
        activeSidebarView: parsed.activeSidebarView ?? "workbooks",
      };
    }
  } catch (e) {
    console.error("Failed to load layout from localStorage:", e);
  }
  return {
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    chatHeight: DEFAULT_CHAT_HEIGHT,
    activeSidebarView: "workbooks",
  };
};

// Save to localStorage
const saveLayout = (sidebarWidth: number, chatHeight: number, activeSidebarView: SidebarView) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sidebarWidth, chatHeight, activeSidebarView })
    );
  } catch (e) {
    console.error("Failed to save layout to localStorage:", e);
  }
};

const initialLayout = loadLayout();

export const useLayoutStore = create<LayoutStore>((set) => ({
  sidebarWidth: initialLayout.sidebarWidth,
  chatHeight: initialLayout.chatHeight,
  activeSidebarView: initialLayout.activeSidebarView,

  setSidebarWidth: (width) => {
    const clampedWidth = Math.max(200, Math.min(800, width));
    set({ sidebarWidth: clampedWidth });
    const state = useLayoutStore.getState();
    saveLayout(clampedWidth, state.chatHeight, state.activeSidebarView);
  },

  setChatHeight: (height) => {
    const clampedHeight = Math.max(150, Math.min(600, height));
    set({ chatHeight: clampedHeight });
    const state = useLayoutStore.getState();
    saveLayout(state.sidebarWidth, clampedHeight, state.activeSidebarView);
  },

  setActiveSidebarView: (view) => {
    set({ activeSidebarView: view });
    const state = useLayoutStore.getState();
    saveLayout(state.sidebarWidth, state.chatHeight, view);
  },

  resetLayout: () => {
    set({
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      chatHeight: DEFAULT_CHAT_HEIGHT,
      activeSidebarView: "workbooks",
    });
    saveLayout(DEFAULT_SIDEBAR_WIDTH, DEFAULT_CHAT_HEIGHT, "workbooks");
  },
}));
