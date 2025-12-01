import { useState, useEffect } from "react";
import { useDashboardStore } from "../../store/dashboardStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { dashboardService } from "../../services/dashboardService";
import { DashboardQueryCard } from "./DashboardQueryCard";
import { DashboardResults } from "./DashboardResults";
import { InputDialog } from "../InputDialog";

export function DashboardBuilder() {
  const {
    dashboards,
    activeDashboardId,
    createDashboard,
    addQuery,
    setActiveDashboard,
    loadDashboards,
  } = useDashboardStore();
  const { workbooks } = useWorkbookStore();
  const [question, setQuestion] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(
    null,
  );
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
    if (activeDashboardId) {
      setSelectedDashboardId(activeDashboardId);
    }
  }, [activeDashboardId, loadDashboards]);

  const activeDashboard = dashboards.find((d) => d.id === selectedDashboardId);

  const handleCreateDashboard = () => {
    setInputDialog({
      isOpen: true,
      title: "Create Dashboard",
      defaultValue: "",
      onConfirm: (name: string) => {
        setInputDialog({ ...inputDialog, isOpen: false });
        if (name) {
          const dashboard = createDashboard(name);
          setSelectedDashboardId(dashboard.id);
        }
      },
    });
  };

  const handleAddQuery = async () => {
    if (!question.trim() || !activeDashboard) return;

    setIsCreating(true);
    try {
      const parsed = await dashboardService.parseQuestion(question, workbooks);
      const workbook = workbooks.find((w) =>
        parsed.workbookName
          ? w.name.toLowerCase().includes(parsed.workbookName.toLowerCase())
          : !w.archived,
      );

      addQuery(activeDashboard.id, {
        question: question.trim(),
        queryType: parsed.queryType || "count",
        workbookId: workbook?.id,
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

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard Builder</h1>
        <div className="flex gap-2">
          <select
            value={selectedDashboardId || ""}
            onChange={(e) => setSelectedDashboardId(e.target.value || null)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="">Select Dashboard...</option>
            {dashboards.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateDashboard}
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
          >
            + New Dashboard
          </button>
        </div>
      </div>

      {!activeDashboard ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-gray-500">
              Create or select a dashboard to get started
            </p>
            <button
              onClick={handleCreateDashboard}
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Create Dashboard
            </button>
          </div>
        </div>
      ) : (
        <>
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
            {activeDashboard.queries.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <p className="mb-2">No queries yet</p>
                <p className="text-sm">
                  Add a question above to create your first dashboard query
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeDashboard.queries.map((query) => (
                  <DashboardQueryCard
                    key={query.id}
                    query={query}
                    dashboardId={activeDashboard.id}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
