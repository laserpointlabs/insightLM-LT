import { create } from "zustand";
import { Dashboard, DashboardQuery } from "../types/dashboard";
import { v4 as uuidv4 } from "uuid";

interface DashboardStore {
  dashboards: Dashboard[];
  activeDashboardId: string | null;

  createDashboard: (name: string) => Dashboard;
  addQuery: (
    dashboardId: string,
    query: Omit<DashboardQuery, "id" | "createdAt">,
  ) => void;
  removeQuery: (dashboardId: string, queryId: string) => void;
  updateQuery: (
    dashboardId: string,
    queryId: string,
    updates: Partial<DashboardQuery>,
  ) => void;
  setActiveDashboard: (id: string | null) => void;
  deleteDashboard: (id: string) => void;
  loadDashboards: () => Promise<void>;
  saveDashboards: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboards: [],
  activeDashboardId: null,

  createDashboard: (name) => {
    const dashboard: Dashboard = {
      id: uuidv4(),
      name,
      queries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      dashboards: [...state.dashboards, dashboard],
      activeDashboardId: dashboard.id,
    }));
    get().saveDashboards();
    return dashboard;
  },

  addQuery: (dashboardId, query) => {
    const newQuery: DashboardQuery = {
      ...query,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id === dashboardId
          ? {
              ...d,
              queries: [...d.queries, newQuery],
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    }));
    get().saveDashboards();
  },

  removeQuery: (dashboardId, queryId) => {
    set((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id === dashboardId
          ? {
              ...d,
              queries: d.queries.filter((q) => q.id !== queryId),
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    }));
    get().saveDashboards();
  },

  updateQuery: (dashboardId, queryId, updates) => {
    set((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id === dashboardId
          ? {
              ...d,
              queries: d.queries.map((q) =>
                q.id === queryId ? { ...q, ...updates } : q,
              ),
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    }));
    get().saveDashboards();
  },

  setActiveDashboard: (id) => set({ activeDashboardId: id }),

  deleteDashboard: (id) => {
    set((state) => ({
      dashboards: state.dashboards.filter((d) => d.id !== id),
      activeDashboardId:
        state.activeDashboardId === id ? null : state.activeDashboardId,
    }));
    get().saveDashboards();
  },

  loadDashboards: async () => {
    // Load from localStorage or IPC
    try {
      const stored = localStorage.getItem("insightlm-dashboards");
      if (stored) {
        set({ dashboards: JSON.parse(stored) });
      }
    } catch (error) {
      console.error("Failed to load dashboards:", error);
    }
  },

  saveDashboards: async () => {
    // Save to localStorage or IPC
    try {
      localStorage.setItem(
        "insightlm-dashboards",
        JSON.stringify(get().dashboards),
      );
    } catch (error) {
      console.error("Failed to save dashboards:", error);
    }
  },
}));
