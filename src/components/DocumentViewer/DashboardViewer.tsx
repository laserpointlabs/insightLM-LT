import { useState, useEffect } from "react";
import { useDashboardStore } from "../../store/dashboardStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { dashboardService } from "../../services/dashboardService";
import { DashboardGrid } from "../Dashboard/DashboardGrid";
import { InputDialog } from "../InputDialog";
import { notifyError } from "../../utils/notify";
import { testIds } from "../../testing/testIds";
import { MentionItem, MentionTextInput } from "../MentionTextInput";

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
  const { workbooks, setWorkbooks, setLoading, setError } = useWorkbookStore();
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

  // Dashboards rely on the workbook list for parsing + @ mentions.
  // Unlike the Workbooks sidebar view, this viewer may be opened first,
  // so we must ensure the workbook store is populated.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!window.electronAPI?.workbook) return;
      if (workbooks.length) return;
      setLoading(true);
      setError(null);
      try {
        const allWorkbooks = await window.electronAPI.workbook.getAll();
        const normalized = Array.isArray(allWorkbooks)
          ? allWorkbooks.map((w: any) => ({
              ...w,
              archived: w.archived ?? false,
              documents: Array.isArray(w.documents)
                ? w.documents.map((d: any) => ({ ...d, archived: d.archived ?? false }))
                : [],
            }))
          : [];
        if (!cancelled) setWorkbooks(normalized);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load workbooks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [setError, setLoading, setWorkbooks, workbooks.length]);

  const dashboard = dashboards.find((d) => d.id === dashboardId);

  const mentionItems: MentionItem[] = (() => {
    const items: MentionItem[] = [];
    for (const wb of workbooks.filter((w) => !w.archived)) {
      items.push({
        kind: "workbook",
        id: wb.id,
        label: wb.name,
        insertText: `workbook://${wb.id}/`,
        searchText: wb.name,
      });
      for (const folderName of wb.folders || []) {
        items.push({
          kind: "folder",
          id: `${wb.id}:${folderName}`,
          label: `${wb.name}/${folderName}`,
          insertText: `workbook://${wb.id}/documents/${folderName}/`,
          searchText: `${wb.name} ${folderName}`,
        });
      }
      for (const doc of wb.documents || []) {
        items.push({
          kind: "file",
          id: `${wb.id}:${doc.path}`,
          label: `${wb.name}/${doc.filename}`,
          insertText: `workbook://${wb.id}/${doc.path}`,
          searchText: `${wb.name} ${doc.filename} ${doc.path}`,
        });
      }
    }
    return items;
  })();

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

      await addQuery(dashboard.id, {
        question: question.trim(),
        title: generateShortTitle(question.trim()), // Add auto-generated short title
        queryType: parsed.queryType || "count",
        workbookId: parsed.workbookId,
        filters: parsed.filters,
      });

      setQuestion("");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to create query", "Dashboards");
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
    // Refresh all queries using the new MCP flow
    setIsCreating(true);
    try {
      for (const query of dashboard.queries) {
        try {
          // Use MCP Dashboard Server (new prompt manager flow)
          if (window.electronAPI?.mcp?.dashboardQuery) {
            // Determine tile type from query
            const tileType = query.tileType ||
                            (query.queryType === "date_range" ? "counter_warning" :
                             query.queryType === "filter" ? "table" :
                             query.queryType === "aggregate" ? "graph" :
                             "counter"); // default

            const response = await window.electronAPI.mcp.dashboardQuery(
              query.question,
              tileType
            );

            if (response && response.success && response.result) {
              await updateQuery(dashboard.id, query.id, {
                result: response.result,
                lastRun: new Date().toISOString(),
              });
            } else if (response && response.error) {
              console.error(`Failed to refresh query ${query.id}:`, response.error);
              await updateQuery(dashboard.id, query.id, {
                result: { type: "error", error: response.error },
                lastRun: new Date().toISOString(),
              });
            }
          } else {
            // Fallback to legacy
            const result = await dashboardService.executeQuery(query, workbooks);
            await updateQuery(dashboard.id, query.id, {
              result,
              lastRun: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error(`Failed to refresh query ${query.id}:`, err);
        }
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
            data-testid={testIds.dashboards.viewer.refreshAll}
          >
            ↻ Refresh All
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <MentionTextInput
              value={question}
              onChange={setQuestion}
              disabled={isCreating}
              placeholder='Ask a question like "How many NDAs do we have?" or type @ to pick a workbook/file…'
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              inputTestId={testIds.dashboards.viewer.addQuestionInput}
              menuTestId={testIds.dashboards.viewer.addQuestionMentionMenu}
              itemTestId={(it) => testIds.dashboards.viewer.addQuestionMentionItem(it.kind, it.id)}
              mentionItems={mentionItems}
              onEnterWhenMenuOpen={() => {}}
              onEnter={() => {
                // Mirror previous Enter-to-submit behavior, but only when the mention menu is closed.
                handleAddQuery();
              }}
            />
          </div>
          <button
            onClick={handleAddQuery}
            disabled={isCreating || !question.trim()}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid={testIds.dashboards.viewer.addQuery}
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
