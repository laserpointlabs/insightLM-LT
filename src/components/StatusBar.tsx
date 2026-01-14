import { testIds } from "../testing/testIds";

export function StatusBar(props: {
  projectLabel: string;
  projectDataDir: string;
  scopeMode: "all" | "context";
  activeContextName: string | null;
  llmLabel?: string | null;
  onToggleScope: () => void;
  onJumpToContexts: () => void;
}) {
  const { projectLabel, projectDataDir, scopeMode, activeContextName, llmLabel, onToggleScope, onJumpToContexts } = props;
  const scopeText =
    scopeMode === "all" ? "All workbooks (Project)" : activeContextName ? activeContextName : "Active context";

  return (
    <div
      className="flex h-7 items-center justify-between border-t border-gray-200 bg-gray-50 px-2 text-[11px] text-gray-700"
      data-testid={testIds.statusBar.container}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex min-w-0 items-center gap-1 truncate"
          data-testid={testIds.statusBar.project}
          title={projectDataDir ? `Project dataDir:\n${projectDataDir}` : projectLabel}
        >
          <span className="text-gray-500">Project:</span>
          <span className="font-semibold" data-testid={testIds.statusBar.projectName}>
            {projectLabel}
          </span>
        </div>

        <button
          type="button"
          className="flex min-w-0 items-center gap-1 truncate text-left hover:text-gray-900"
          onClick={onJumpToContexts}
          title="Jump to Contexts"
          data-testid={testIds.statusBar.jumpToContexts}
        >
          <span className="text-gray-500">Scope:</span>
          <span className="truncate font-medium" data-testid={testIds.statusBar.scopeText}>
            {scopeText}
          </span>
        </button>

        <button
          type="button"
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide ${
            scopeMode === "all" ? "bg-gray-200 text-gray-700 hover:bg-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          onClick={onToggleScope}
          aria-label="Toggle scope mode"
          title={scopeMode === "all" ? "Scoping: All workbooks (click to enable context scoping)" : "Scoping: Active context only (click to disable)"}
          data-testid={testIds.statusBar.scopeToggle}
        >
          {scopeMode === "all" ? "ALL" : "SCOPED"}
        </button>
      </div>

      <div className="min-w-0" data-testid={testIds.statusBar.scope}>
        <div
          className="flex min-w-0 items-center justify-end gap-2 truncate text-right"
          data-testid={testIds.statusBar.llm}
          title={llmLabel ? `Active LLM:\n${llmLabel}` : "Active LLM: unknown"}
        >
          <span className="text-gray-500">LLM:</span>
          <span className="truncate font-medium">{llmLabel || "unknown"}</span>
        </div>
      </div>
    </div>
  );
}
