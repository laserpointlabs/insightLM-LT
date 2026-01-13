import { create } from "zustand";

export type WorkbenchId = "file" | "extensions" | "data" | "analysis" | "event";

export type WorkbenchView = "workbooks" | "dashboards" | "chat";

export interface Workbench {
  id: WorkbenchId;
  name: string;
  views: WorkbenchView[];
  icon: string; // SVG path or icon identifier
}

interface WorkbenchStore {
  activeWorkbenchId: WorkbenchId;
  activeView: WorkbenchView;
  workbenches: Workbench[];

  setActiveWorkbench: (id: WorkbenchId) => void;
  setActiveView: (view: WorkbenchView) => void;
}

const WORKBENCHES: Workbench[] = [
  {
    id: "file",
    name: "Insight Workbench",
    views: ["dashboards", "workbooks", "chat"],
    icon: "file",
  },
  {
    id: "extensions",
    name: "Extensions Workbench",
    views: [],
    icon: "extensions",
  },
  {
    id: "data",
    name: "Data Workbench",
    views: [],
    icon: "data",
  },
  {
    id: "analysis",
    name: "Analysis Workbench",
    views: [],
    icon: "analysis",
  },
  {
    id: "event",
    name: "Event Workbench",
    views: [],
    icon: "event",
  },
];

const STORAGE_KEY = "insightlm-workbench-storage";

const loadWorkbench = (): { activeWorkbenchId: WorkbenchId; activeView: WorkbenchView } => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        activeWorkbenchId: parsed.activeWorkbenchId ?? "file",
        activeView: parsed.activeView ?? "workbooks",
      };
    }
  } catch (e) {
    console.error("Failed to load workbench from localStorage:", e);
  }
  return {
    activeWorkbenchId: "file",
    activeView: "workbooks",
  };
};

const saveWorkbench = (activeWorkbenchId: WorkbenchId, activeView: WorkbenchView) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ activeWorkbenchId, activeView })
    );
  } catch (e) {
    console.error("Failed to save workbench to localStorage:", e);
  }
};

const initialWorkbench = loadWorkbench();

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  activeWorkbenchId: initialWorkbench.activeWorkbenchId,
  activeView: initialWorkbench.activeView,
  workbenches: WORKBENCHES,

  setActiveWorkbench: (id) => {
    const workbench = WORKBENCHES.find((w) => w.id === id);
    if (workbench) {
      // Set default view for the workbench
      const defaultView = workbench.views.length > 0 ? workbench.views[0] : "workbooks";
      set({ activeWorkbenchId: id, activeView: defaultView });
      saveWorkbench(id, defaultView);
    }
  },

  setActiveView: (view) => {
    const state = get();
    set({ activeView: view });
    saveWorkbench(state.activeWorkbenchId, view);
  },
}));
