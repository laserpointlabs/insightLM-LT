import { create } from "zustand";

export type WorkbenchViewId = "dashboards" | "workbooks" | "chat";

interface LayoutStore {
  sidebarWidth: number; // Width of left sidebar in pixels
  chatHeight: number; // Height of chat area in pixels (from bottom)

  // Workbench view states
  viewHeights: Record<WorkbenchViewId, number>;
  collapsedViews: Set<WorkbenchViewId>;

  setSidebarWidth: (width: number) => void;
  setChatHeight: (height: number) => void;
  setViewHeight: (viewId: WorkbenchViewId, height: number) => void;
  toggleViewCollapse: (viewId: WorkbenchViewId) => void;
  resetLayout: () => void;
}

const DEFAULT_SIDEBAR_WIDTH = 256; // 64 * 4 = 256px (w-64)
const DEFAULT_CHAT_HEIGHT = 256; // 64 * 4 = 256px (h-64)
const DEFAULT_VIEW_HEIGHT = 200; // Default height for each view

const STORAGE_KEY = "insightlm-layout-storage";

// Load from localStorage
const loadLayout = (): {
  sidebarWidth: number;
  chatHeight: number;
  viewHeights: Record<WorkbenchViewId, number>;
  collapsedViews: Set<WorkbenchViewId>;
} => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        sidebarWidth: parsed.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
        chatHeight: parsed.chatHeight ?? DEFAULT_CHAT_HEIGHT,
        viewHeights: parsed.viewHeights ?? {
          dashboards: DEFAULT_VIEW_HEIGHT,
          workbooks: DEFAULT_VIEW_HEIGHT,
          chat: DEFAULT_VIEW_HEIGHT,
        },
        collapsedViews: new Set(parsed.collapsedViews ?? []),
      };
    }
  } catch (e) {
    console.error("Failed to load layout from localStorage:", e);
  }
  return {
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    chatHeight: DEFAULT_CHAT_HEIGHT,
    viewHeights: {
      dashboards: DEFAULT_VIEW_HEIGHT,
      workbooks: DEFAULT_VIEW_HEIGHT,
      chat: DEFAULT_VIEW_HEIGHT,
    },
    collapsedViews: new Set(),
  };
};

// Save to localStorage
const saveLayout = (
  sidebarWidth: number,
  chatHeight: number,
  viewHeights: Record<WorkbenchViewId, number>,
  collapsedViews: Set<WorkbenchViewId>
) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sidebarWidth,
        chatHeight,
        viewHeights,
        collapsedViews: Array.from(collapsedViews),
      })
    );
  } catch (e) {
    console.error("Failed to save layout to localStorage:", e);
  }
};

const initialLayout = loadLayout();

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  sidebarWidth: initialLayout.sidebarWidth,
  chatHeight: initialLayout.chatHeight,
  viewHeights: initialLayout.viewHeights,
  collapsedViews: initialLayout.collapsedViews,

  setSidebarWidth: (width) => {
    const clampedWidth = Math.max(200, Math.min(800, width));
    set({ sidebarWidth: clampedWidth });
    const state = get();
    saveLayout(clampedWidth, state.chatHeight, state.viewHeights, state.collapsedViews);
  },

  setChatHeight: (height) => {
    const clampedHeight = Math.max(150, Math.min(600, height));
    set({ chatHeight: clampedHeight });
    const state = get();
    saveLayout(state.sidebarWidth, clampedHeight, state.viewHeights, state.collapsedViews);
  },

  setViewHeight: (viewId, height) => {
    const clampedHeight = Math.max(50, Math.min(1000, height));
    set((state) => ({
      viewHeights: { ...state.viewHeights, [viewId]: clampedHeight },
    }));
    const state = get();
    saveLayout(state.sidebarWidth, state.chatHeight, state.viewHeights, state.collapsedViews);
  },

  toggleViewCollapse: (viewId) => {
    set((state) => {
      const newCollapsed = new Set(state.collapsedViews);
      if (newCollapsed.has(viewId)) {
        newCollapsed.delete(viewId);
      } else {
        newCollapsed.add(viewId);
      }
      return { collapsedViews: newCollapsed };
    });
    const state = get();
    saveLayout(state.sidebarWidth, state.chatHeight, state.viewHeights, state.collapsedViews);
  },

  resetLayout: () => {
    const defaultViewHeights = {
      dashboards: DEFAULT_VIEW_HEIGHT,
      workbooks: DEFAULT_VIEW_HEIGHT,
      chat: DEFAULT_VIEW_HEIGHT,
    };
    set({
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      chatHeight: DEFAULT_CHAT_HEIGHT,
      viewHeights: defaultViewHeights,
      collapsedViews: new Set(),
    });
    saveLayout(DEFAULT_SIDEBAR_WIDTH, DEFAULT_CHAT_HEIGHT, defaultViewHeights, new Set());
  },
}));
