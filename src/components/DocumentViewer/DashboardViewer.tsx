import { useState, useEffect } from "react";
import { useDashboardStore } from "../../store/dashboardStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { dashboardService } from "../../services/dashboardService";
import { DashboardQueryCard } from "../Dashboard/DashboardQueryCard";
import { InputDialog } from "../InputDialog";

interface DashboardViewerProps {
  dashboardId: string;
}

export function DashboardViewer({ dashboardId }: DashboardViewerProps) {
  const {
    dashboards,
    addQuery,
    loadDashboards,
  } = useDashboardStore();
  const { workbooks } = useWorkbookStore();
  const [question, setQuestion] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  const dashboard = dashboards.find((d) => d.id === dashboardId);

  const handleAddQuery = async () => {
    if (!question.trim() || !dashboard) return;

    setIsCreating(true);
    try {
      const parsed = await dashboardService.parseQuestion(question, workbooks);

      addQuery(dashboard.id, {
        question: question.trim(),
        queryType: parsed.queryType || "count",
        workbookId: parsed.workbookId,
        filters: parsed.filters,
      });

      setQuestion("");
    } catch (error) {
      alert(
        `Failed to create query: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Dashboard not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{dashboard.name}</h1>
      </div>

      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddQuery()}
            placeholder='Ask a question like "How many NDAs do we have?" or "How many NDAs are expiring within 90 days?"'
            className="flex-1 rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isCreating}
          />
          <button
            onClick={handleAddQuery}
            disabled={isCreating || !question.trim()}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Add Query"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {dashboard.queries.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <p className="mb-2">No queries yet</p>
            <p className="text-sm">
              Add a question above to create your first dashboard query
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {dashboard.queries.map((query) => (
              <DashboardQueryCard
                key={query.id}
                query={query}
                dashboardId={dashboard.id}
              />
            ))}
          </div>
        )}
      </div>

      <InputDialog
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        defaultValue={inputDialog.defaultValue}
        onConfirm={inputDialog.onConfirm}
        onCancel={() => setInputDialog({ ...inputDialog, isOpen: false })}
      />
    </div>
  );
}
