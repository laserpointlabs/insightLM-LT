import { create } from "zustand";
import { Dashboard, DashboardQuery } from "../types/dashboard";
import { v4 as uuidv4 } from "uuid";

interface DashboardStore {
  dashboards: Dashboard[];
  activeDashboardId: string | null;

  createDashboard: (name: string) => Promise<Dashboard>;
  addQuery: (
    dashboardId: string,
    query: Omit<DashboardQuery, "id" | "createdAt">,
  ) => Promise<void>;
  removeQuery: (dashboardId: string, queryId: string) => Promise<void>;
  updateQuery: (
    dashboardId: string,
    queryId: string,
    updates: Partial<DashboardQuery>,
  ) => Promise<void>;
  setActiveDashboard: (id: string | null) => void;
  renameDashboard: (id: string, newName: string) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  loadDashboards: () => Promise<void>;
  saveDashboards: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboards: [],
  activeDashboardId: null,

  createDashboard: async (name) => {
    if (window.electronAPI?.dashboard) {
      try {
        const dashboard = await window.electronAPI.dashboard.create(name);
        set((state) => ({
          dashboards: [...state.dashboards, dashboard],
          activeDashboardId: dashboard.id,
        }));
        return dashboard;
      } catch (error) {
        console.error("Failed to create dashboard:", error);
        throw error;
      }
    }
    // Fallback to localStorage if IPC not available
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
    await get().saveDashboards();
    return dashboard;
  },

  addQuery: async (dashboardId, query) => {
    const dashboard = get().dashboards.find((d) => d.id === dashboardId);
    const existingQueries = dashboard?.queries || [];

    // Helper function to get tile width based on size
    // Note: Full-width tiles are handled specially in addQuery - they always use x=0
    // and their actual width is calculated dynamically in DashboardGrid based on container width
    const getTileWidth = (size: "small" | "medium" | "large" | "full-width" | undefined): number => {
      if (!size) return 2; // Default medium
      if (size === "small") return 1;
      if (size === "medium") return 2;
      if (size === "large") return 3; // Large is now 3 columns wide
      if (size === "full-width") return 4; // Not used for positioning - full-width tiles handled separately
      return 2;
    };

    // Helper function to get tile height based on size
    const getTileHeight = (size: "small" | "medium" | "large" | "full-width" | undefined): number => {
      if (!size) return 1;
      return size === "large" ? 2 : 1;
    };

    // Auto-determine tile size based on query type
    let tileSize: "small" | "medium" | "large" | "full-width" = "medium";
    if (query.queryType === "count") {
      tileSize = "small";
    } else if (query.queryType === "filter") {
      tileSize = "full-width";
    }

    const newTileHeight = getTileHeight(tileSize);

    // Handle full-width tiles specially - they always start at x=0 and span entire width
    if (tileSize === "full-width") {
      // For full-width tiles, only check vertical overlap (y position)
      // Find first available y position
      let nextY = 0;
      const maxY = Math.max(
        ...existingQueries.map((q) => {
          const pos = q.tilePosition || { x: 0, y: 0 };
          const height = getTileHeight(q.tileSize);
          return pos.y + height;
        }),
        0
      );

      // Check for vertical overlap with existing tiles
      const hasVerticalOverlap = (y: number, height: number): boolean => {
        return existingQueries.some((q) => {
          const pos = q.tilePosition || { x: 0, y: 0 };
          const qHeight = getTileHeight(q.tileSize);
          // Check if tiles overlap vertically
          return (
            (y >= pos.y && y < pos.y + qHeight) ||
            (y + height > pos.y && y + height <= pos.y + qHeight) ||
            (y <= pos.y && y + height > pos.y + qHeight)
          );
        });
      };

      // Find first available y position
      while (hasVerticalOverlap(nextY, newTileHeight)) {
        nextY++;
        // Safety check to prevent infinite loop
        if (nextY > 100) {
          console.warn("Could not find valid position for full-width tile - grid may be full");
          // Place at the end of the grid as fallback
          nextY = maxY;
          break;
        }
      }

      const newQuery: DashboardQuery = {
        ...query,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        tilePosition: { x: 0, y: nextY }, // Full-width tiles always at x=0
        tileSize,
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
      await get().saveDashboards();
      return; // Early return for full-width tiles
    }

    // For non-full-width tiles, use standard collision detection
    // Build set of ALL occupied cells (accounting for tile width/height)
    const occupiedPositions = new Set<string>();
    existingQueries.forEach((q) => {
      const pos = q.tilePosition;
      if (!pos) return;

      // Skip full-width tiles in collision detection - they're handled separately
      if (q.tileSize === "full-width") return;

      const width = getTileWidth(q.tileSize);
      const height = getTileHeight(q.tileSize);

      // Mark all cells occupied by this tile
      for (let x = pos.x; x < pos.x + width; x++) {
        for (let y = pos.y; y < pos.y + height; y++) {
          occupiedPositions.add(`${x},${y}`);
        }
      }
    });

    const newTileWidth = getTileWidth(tileSize);
    const maxGridWidth = 4; // Maximum grid width

    // Check for vertical overlap with full-width tiles
    const hasVerticalOverlapWithFullWidth = (y: number, height: number): boolean => {
      return existingQueries.some((q) => {
        if (q.tileSize !== "full-width") return false;
        const pos = q.tilePosition || { x: 0, y: 0 };
        const qHeight = getTileHeight(q.tileSize);
        // Check if tiles overlap vertically
        return (
          (y >= pos.y && y < pos.y + qHeight) ||
          (y + height > pos.y && y + height <= pos.y + qHeight) ||
          (y <= pos.y && y + height > pos.y + qHeight)
        );
      });
    };

    const canPlaceAt = (x: number, y: number, width: number, height: number): boolean => {
      // Check if tile fits within grid bounds
      if (x + width > maxGridWidth) return false;

      // Check for vertical overlap with full-width tiles (they span entire width)
      if (hasVerticalOverlapWithFullWidth(y, height)) {
        return false;
      }

      // Check if all required cells are available (for non-full-width tiles)
      for (let checkX = x; checkX < x + width; checkX++) {
        for (let checkY = y; checkY < y + height; checkY++) {
          if (occupiedPositions.has(`${checkX},${checkY}`)) {
            return false;
          }
        }
      }
      return true;
    };

    // Find first available position
    let nextX = 0;
    let nextY = 0;
    while (!canPlaceAt(nextX, nextY, newTileWidth, newTileHeight)) {
      nextX++;
      if (nextX + newTileWidth > maxGridWidth) {
        nextX = 0;
        nextY++;
      }
      // Safety check to prevent infinite loop
      if (nextY > 100) {
        console.warn("Could not find valid position for new query - grid may be full");
        // Place at the end of the grid as fallback
        nextY = Math.max(...existingQueries.map((q) => {
          const pos = q.tilePosition || { x: 0, y: 0 };
          const height = getTileHeight(q.tileSize);
          return pos.y + height;
        }), 0);
        nextX = 0;
        break; // Exit loop even if position might overlap
      }
    }

    const newQuery: DashboardQuery = {
      ...query,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      tilePosition: { x: nextX, y: nextY },
      tileSize,
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
    await get().saveDashboards();
  },

  removeQuery: async (dashboardId, queryId) => {
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
    await get().saveDashboards();
  },

  updateQuery: async (dashboardId, queryId, updates) => {
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
    await get().saveDashboards();
  },

  setActiveDashboard: (id) => set({ activeDashboardId: id }),

  renameDashboard: async (id, newName) => {
    if (window.electronAPI?.dashboard) {
      try {
        await window.electronAPI.dashboard.rename(id, newName);
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === id
              ? { ...d, name: newName, updatedAt: new Date().toISOString() }
              : d
          ),
        }));
        return;
      } catch (error) {
        console.error("Failed to rename dashboard:", error);
        throw error;
      }
    }
    // Fallback to localStorage if IPC not available
    set((state) => ({
      dashboards: state.dashboards.map((d) =>
        d.id === id
          ? { ...d, name: newName, updatedAt: new Date().toISOString() }
          : d
      ),
    }));
    await get().saveDashboards();
  },

  deleteDashboard: async (id) => {
    if (window.electronAPI?.dashboard) {
      try {
        await window.electronAPI.dashboard.delete(id);
        set((state) => ({
          dashboards: state.dashboards.filter((d) => d.id !== id),
          activeDashboardId:
            state.activeDashboardId === id ? null : state.activeDashboardId,
        }));
        return;
      } catch (error) {
        console.error("Failed to delete dashboard:", error);
        throw error;
      }
    }
    // Fallback to localStorage if IPC not available
    set((state) => ({
      dashboards: state.dashboards.filter((d) => d.id !== id),
      activeDashboardId:
        state.activeDashboardId === id ? null : state.activeDashboardId,
    }));
    await get().saveDashboards();
  },

  loadDashboards: async () => {
    // Load from IPC (file system) or fallback to localStorage
    if (window.electronAPI?.dashboard) {
      try {
        const dashboards = await window.electronAPI.dashboard.getAll();
        // If no dashboards in file system, try to migrate from localStorage
        if (dashboards.length === 0) {
          try {
            const stored = localStorage.getItem("insightlm-dashboards");
            if (stored) {
              const localDashboards = JSON.parse(stored) as Dashboard[];
              if (localDashboards.length > 0) {
                // Migrate dashboards from localStorage to file system
                await window.electronAPI.dashboard.saveAll(localDashboards);
                // Clear localStorage after successful migration
                localStorage.removeItem("insightlm-dashboards");
                set({ dashboards: localDashboards });
                return;
              }
            }
          } catch (migrationError) {
            console.error("Failed to migrate dashboards from localStorage:", migrationError);
            // Fall back to loading from localStorage if migration fails
            try {
              const stored = localStorage.getItem("insightlm-dashboards");
              if (stored) {
                const localDashboards = JSON.parse(stored) as Dashboard[];
                set({ dashboards: localDashboards });
                return;
              }
            } catch (localStorageError) {
              console.error("Failed to load dashboards from localStorage after migration failure:", localStorageError);
            }
          }
        }
        set({ dashboards: Array.isArray(dashboards) ? dashboards : [] });
        return;
      } catch (error) {
        console.error("Failed to load dashboards from IPC:", error);
        // Fall back to localStorage if IPC load fails
        try {
          const stored = localStorage.getItem("insightlm-dashboards");
          if (stored) {
            const localDashboards = JSON.parse(stored) as Dashboard[];
            set({ dashboards: localDashboards });
            return;
          }
        } catch (localStorageError) {
          console.error("Failed to load dashboards from localStorage after IPC failure:", localStorageError);
        }
      }
    }
    // Fallback to localStorage if IPC not available
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
    // Save via IPC (file system) - save all dashboards at once
    if (window.electronAPI?.dashboard) {
      try {
        const dashboards = get().dashboards;
        await window.electronAPI.dashboard.saveAll(dashboards);
        return;
      } catch (error) {
        console.error("Failed to save dashboards via IPC:", error);
      }
    }
    // Fallback to localStorage if IPC not available
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
