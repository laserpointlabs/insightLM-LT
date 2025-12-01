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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-semibold">{query.question}</h3>
          <div className="text-xs text-gray-500">
            Type: {query.queryType} |
            {query.lastRun &&
              ` Last run: ${new Date(query.lastRun).toLocaleString()}`}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runQuery}
            disabled={isRunning}
            className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200 disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Refresh"}
          </button>
          <button
            onClick={() => removeQuery(dashboardId, query.id)}
            className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        </div>
      </div>

      {result && <DashboardResults result={result} />}
    </div>
  );
}
