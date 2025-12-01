export interface DashboardQuery {
  id: string;
  question: string;
  queryType: "count" | "filter" | "date_range" | "aggregate" | "custom";
  workbookId?: string;
  filters?: Record<string, any>;
  createdAt: string;
  lastRun?: string;
  result?: DashboardResult;
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
