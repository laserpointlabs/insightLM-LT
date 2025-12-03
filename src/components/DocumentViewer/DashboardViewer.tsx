import { useState, useEffect } from "react";
import { useDashboardStore } from "../../store/dashboardStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { dashboardService } from "../../services/dashboardService";
import { DashboardGrid } from "../Dashboard/DashboardGrid";
import { InputDialog } from "../InputDialog";

interface DashboardViewerProps {
  dashboardId: string;
}

export function DashboardViewer({ dashboardId }: DashboardViewerProps) {
  const {
    dashboards,
    addQuery,
    updateQuery,
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

      // Generate a short default title from the question
      const generateShortTitle = (fullQuestion: string): string => {
        const q = fullQuestion.toLowerCase();

        // Pattern: "how many X" -> "X Count"
        const howManyMatch = q.match(/how many (\w+(?:\s+\w+)?)/);
        if (howManyMatch) {
          const subject = howManyMatch[1];
          return subject.charAt(0).toUpperCase() + subject.slice(1);
        }

        // Pattern: "show me X" or "list X" -> "X"
        const showListMatch = q.match(/(?:show me|list) (\w+(?:\s+\w+)?)/);
        if (showListMatch) {
          const subject = showListMatch[1];
          return subject.charAt(0).toUpperCase() + subject.slice(1);
        }

        // Pattern: mentions workbook name -> use workbook name
        const workbook = workbooks.find(wb =>
          q.includes(wb.name.toLowerCase())
        );
        if (workbook) {
          return workbook.name;
        }

        // Default: take first 3-4 meaningful words
        const words = fullQuestion.split(' ').filter(w =>
          !['how', 'many', 'do', 'we', 'have', 'the', 'are', 'is', 'in', 'a', 'an'].includes(w.toLowerCase())
        );
        const shortTitle = words.slice(0, 3).join(' ');
        return shortTitle.length > 25
          ? shortTitle.substring(0, 25) + '...'
          : shortTitle || fullQuestion.substring(0, 20);
      };

      addQuery(dashboard.id, {
        question: question.trim(),
        title: generateShortTitle(question.trim()), // Add auto-generated short title
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

  const handleRefreshAll = async () => {
    // Trigger refresh on all queries by clearing their results
    // This will cause auto-run to kick in
    setIsCreating(true);
    try {
      for (const query of dashboard.queries) {
        await dashboardService.executeQuery(query, workbooks).then(result => {
          updateQuery(dashboard.id, query.id, {
            result,
            lastRun: new Date().toISOString(),
          });
        }).catch(err => {
          console.error(`Failed to refresh query ${query.id}:`, err);
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{dashboard.name}</h1>
        {dashboard.queries.length > 0 && (
          <button
            onClick={handleRefreshAll}
            disabled={isCreating}
            className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh all queries"
          >
            ↻ Refresh All
          </button>
        )}
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

      <div className="flex-1 overflow-auto p-4">
        {dashboard.queries.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <p className="mb-2">No queries yet</p>
            <p className="text-sm">
              Add a question above to create your first dashboard tile
            </p>
          </div>
        ) : (
          <DashboardGrid queries={dashboard.queries} dashboardId={dashboard.id} />
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
