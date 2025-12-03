export interface DashboardQuery {
  id: string;
  question: string;
  title?: string; // Optional custom title (defaults to question if not set)
  queryType: "count" | "filter" | "date_range" | "aggregate" | "custom";
  workbookId?: string;
  filters?: Record<string, any>;
  createdAt: string;
  lastRun?: string;
  result?: DashboardResult;
  // Tile layout properties
  tileSize?: "small" | "medium" | "large" | "full-width"; // Size of the tile
  tilePosition?: { x: number; y: number }; // Grid position (for drag-and-drop)
}

export interface DashboardResult {
  value?: number | string;
  data?: Array<Record<string, any>>;
  chartType?: "table" | "bar" | "line" | "pie" | "card";
  metadata?: Record<string, any>;
}

export interface Dashboard {
  id: string;
  name: string;
  queries: DashboardQuery[];
  createdAt: string;
  updatedAt: string;
}
