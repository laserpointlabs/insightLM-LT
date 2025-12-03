import { useState, useEffect } from "react";
import { DashboardQuery } from "../../types/dashboard";
import { useDashboardStore } from "../../store/dashboardStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { dashboardService } from "../../services/dashboardService";
import { DashboardResults } from "./DashboardResults";

interface DashboardQueryCardProps {
  query: DashboardQuery;
  dashboardId: string;
}

export function DashboardQueryCard({
  query,
  dashboardId,
}: DashboardQueryCardProps) {
  const { updateQuery, removeQuery } = useDashboardStore();
  const { workbooks } = useWorkbookStore();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(query.result);

  useEffect(() => {
    // Auto-run query on mount if no result
    if (!result) {
      runQuery();
    }
  }, []);

  const runQuery = async () => {
    setIsRunning(true);
    try {
      const queryResult = await dashboardService.executeQuery(query, workbooks);
      setResult(queryResult);
      updateQuery(dashboardId, query.id, {
        result: queryResult,
        lastRun: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to run query:", error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded border border-gray-200 bg-white p-2">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 text-xs font-semibold text-gray-800 truncate">{query.question}</h3>
          <div className="text-xs text-gray-500">
            {query.queryType}
            {query.lastRun &&
              ` • ${new Date(query.lastRun).toLocaleTimeString()}`}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={runQuery}
            disabled={isRunning}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-xs hover:bg-gray-200 disabled:opacity-50"
            title="Refresh"
          >
            {isRunning ? "..." : "↻"}
          </button>
          <button
            onClick={async () => {
              try {
                await removeQuery(dashboardId, query.id);
              } catch (err) {
                console.error("Failed to remove query:", err);
              }
            }}
            className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>

      {result && <DashboardResults result={result} />}
    </div>
  );
}
