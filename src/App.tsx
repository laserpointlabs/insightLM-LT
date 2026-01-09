import { useState, useEffect, useCallback } from "react";
import { WorkbooksView } from "./components/Sidebar/WorkbooksView";
import { ContextsView } from "./components/Sidebar/ContextsView";
import { Chat } from "./components/Sidebar/Chat";
import { DashboardView } from "./components/Sidebar/DashboardView";
import { DocumentViewer } from "./components/DocumentViewer/DocumentViewer";
import { ActivityBar } from "./components/ActivityBar";
import { CollapsibleView } from "./components/CollapsibleView";
import { ResizablePane } from "./components/ResizablePane";
import { useDocumentStore } from "./store/documentStore";
import { useLayoutStore } from "./store/layoutStore";
import { useWorkbenchStore } from "./store/workbenchStore";
import { extensionRegistry } from "./services/extensionRegistry";
import { jupyterExtensionManifest } from "./extensions/jupyter";
import { spreadsheetExtensionManifest } from "./extensions/spreadsheet";
import { ExtensionToggle } from "./components/Extensions/ExtensionToggle";
import { ToastCenter } from "./components/Notifications/ToastCenter";
import { initAutomationUI } from "./testing/automationUi";
import { testIds } from "./testing/testIds";
import { notifyError, notifySuccess } from "./utils/notify";
import { SearchIcon } from "./components/Icons";

function App() {
  const [dashboardActionButton, setDashboardActionButton] = useState<React.ReactNode>(null);
  const [contextsActionButton, setContextsActionButton] = useState<React.ReactNode>(null);
  const [workbookActionButton, setWorkbookActionButton] = useState<React.ReactNode>(null);
  const [chatActionButton, setChatActionButton] = useState<React.ReactNode>(null);
  const [activeContextName, setActiveContextName] = useState<string | null>(null);
  const [contextScopeMode, setContextScopeMode] = useState<"all" | "context">("context");
  const { openDocuments, closeDocument, openDocument } = useDocumentStore();
  const {
    sidebarWidth,
    viewHeights,
    collapsedViews,
    setSidebarWidth,
    setViewHeight,
    toggleViewCollapse,
  } = useLayoutStore();
  const { activeWorkbenchId, workbenches, setActiveWorkbench } = useWorkbenchStore();

  const activeWorkbench = workbenches.find((w) => w.id === activeWorkbenchId);

  // Stable callback identity to avoid ContextsView action button effect loops.
  const handleActiveContextChanged = useCallback(() => {
    window.dispatchEvent(new CustomEvent("context:changed"));
  }, []);

  // Register extensions on app startup
  useEffect(() => {
    extensionRegistry.register(jupyterExtensionManifest);
    extensionRegistry.register(spreadsheetExtensionManifest);
  }, []);

  // Restore "popped out" Chat tab after renderer refresh (Vite reload / Ctrl+R).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("insightlm.openTabs.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const t of parsed) {
        const type = String(t?.type || "");
        if (type === "chat") {
          const chatKey = String(t?.chatKey || "main").trim() || "main";
          const filename = String(t?.filename || "Chat").trim() || "Chat";
          openDocument({ type: "chat", chatKey, filename } as any).catch(() => {});
          continue;
        }
        if (type === "document") {
          const workbookId = String(t?.workbookId || "").trim();
          const p = String(t?.path || "").trim();
          if (!workbookId || !p) continue;
          const filename = String(t?.filename || p.split("/").pop() || p).trim() || (p.split("/").pop() || p);
          openDocument({ workbookId, path: p, filename } as any).catch(() => {});
          continue;
        }
        if (type === "dashboard") {
          const dashboardId = String(t?.dashboardId || "").trim();
          if (!dashboardId) continue;
          const filename = String(t?.filename || "Dashboard").trim() || "Dashboard";
          openDocument({ type: "dashboard", dashboardId, filename } as any).catch(() => {});
          continue;
        }
        if (type === "config") {
          const configKey = String(t?.configKey || "").trim();
          if (!configKey) continue;
          const filename = String(t?.filename || "config").trim() || "config";
          openDocument({ type: "config", configKey, filename } as any).catch(() => {});
          continue;
        }
      }
    } catch {
      // ignore
    }
  }, [openDocument]);

  // Lightweight automation mode: bots can force-show hover-only controls via `window.__insightlmAutomationUI.setMode(true)`.
  useEffect(() => {
    return initAutomationUI();
  }, []);

  // Best-effort "Active context" indicator in the sidebar header.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!window.electronAPI?.mcp?.call) return;
        const res = await window.electronAPI.mcp.call("context-manager", "tools/call", {
          name: "get_active_context",
          arguments: {},
        });
        const name = res?.active?.name ?? null;
        if (!cancelled) setActiveContextName(name);
      } catch {
        if (!cancelled) setActiveContextName(null);
      }
    };

    load();
    const onChanged = () => load();
    window.addEventListener("context:changed", onChanged as any);
    return () => {
      cancelled = true;
      window.removeEventListener("context:changed", onChanged as any);
    };
  }, []);

  // Context scoping mode (All vs Scoped) – keep in App so headers can always reflect state.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const modeRes = await window.electronAPI?.contextScope?.getMode?.();
        const mode = modeRes?.mode;
        if (!cancelled && (mode === "all" || mode === "context")) setContextScopeMode(mode);
      } catch {
        // ignore (leave default)
      }
    };
    load();

    const onScoping = (e: Event) => {
      const ce = e as CustomEvent<any>;
      const mode = ce?.detail?.mode;
      if (mode === "all" || mode === "context") setContextScopeMode(mode);
    };
    window.addEventListener("context:scoping", onScoping as any);
    return () => {
      cancelled = true;
      window.removeEventListener("context:scoping", onScoping as any);
    };
  }, []);

  const toggleContextScoping = useCallback(async () => {
    const next = contextScopeMode === "context" ? "all" : "context";
    try {
      await window.electronAPI?.contextScope?.setMode?.(next);
      setContextScopeMode(next);
      window.dispatchEvent(new CustomEvent("context:scoping", { detail: { mode: next } }));
      notifySuccess(
        next === "all" ? "Context scoping disabled (All workbooks)" : "Context scoping enabled",
        "Contexts",
      );
    } catch {
      notifyError("Failed to change scoping mode", "Contexts");
    }
  }, [contextScopeMode]);

  const jumpToContexts = useCallback(() => {
    // Ensure we're in the Insight (file) workbench where Contexts exist.
    if (activeWorkbenchId !== "file") {
      setActiveWorkbench("file");
    }

    // Expand Contexts if collapsed.
    if (collapsedViews.has("contexts")) {
      toggleViewCollapse("contexts");
    }

    // Scroll the Contexts header into view (best-effort).
    setTimeout(() => {
      const el = document.querySelector(
        `[data-testid="${testIds.sidebar.headers.contexts}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest" });
      // Focus the header button for keyboard users.
      el?.focus?.();
    }, 0);
  }, [activeWorkbenchId, collapsedViews, setActiveWorkbench, toggleViewCollapse]);

  const renderWorkbenchContent = () => {
    // For Insight Workbench (file), show all views stacked vertically with resizing
    if (activeWorkbenchId === "file") {
      const isDashboardsCollapsed = collapsedViews.has("dashboards");
      const isContextsCollapsed = collapsedViews.has("contexts");
      const isWorkbooksCollapsed = collapsedViews.has("workbooks");
      const isChatCollapsed = collapsedViews.has("chat");

      const focusWorkbooksSearch = async () => {
        // Persist intent so WorkbooksView can focus even if it mounts after we dispatch.
        (window as any).__insightlmFocusWorkbooksSearch = true;
        try {
          window.dispatchEvent(new CustomEvent("workbooks:focusSearch"));
        } catch {
          // ignore
        }
      };
      const openWorkbooksAndFocusSearch = async () => {
        if (isWorkbooksCollapsed) {
          toggleViewCollapse("workbooks");
          // Give React a beat to mount the view.
          setTimeout(() => {
            focusWorkbooksSearch().catch(() => {});
          }, 0);
        } else {
          focusWorkbooksSearch().catch(() => {});
        }
      };

      const workbooksSearchButton = (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openWorkbooksAndFocusSearch().catch(() => {});
          }}
          className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          title="Search workbooks"
          data-testid={testIds.workbooks.header.search}
        >
          <SearchIcon className="h-4 w-4" />
        </button>
      );

      const workbooksHeaderActions = workbookActionButton;

      return (
        <div className="flex h-full flex-col">
          {/* Dashboards View - First */}
          {!isDashboardsCollapsed ? (
            <div
              style={{
                flexBasis: `${viewHeights.dashboards}px`,
                flexShrink: 0,
                minHeight: "50px",
              }}
              className="overflow-hidden"
            >
              <CollapsibleView
                title="Dashboards"
                isCollapsed={isDashboardsCollapsed}
                onToggleCollapse={() => toggleViewCollapse("dashboards")}
                actionButton={dashboardActionButton}
                testId={testIds.sidebar.headers.dashboards}
              >
                <DashboardView onActionButton={setDashboardActionButton} />
              </CollapsibleView>
            </div>
          ) : (
            <div className="border-b border-gray-200">
              <CollapsibleView
                title="Dashboards"
                isCollapsed={isDashboardsCollapsed}
                onToggleCollapse={() => toggleViewCollapse("dashboards")}
                actionButton={dashboardActionButton}
                testId={testIds.sidebar.headers.dashboards}
              >
                <div />
              </CollapsibleView>
            </div>
          )}

          {/* Resizable Separator between Dashboards and Contexts */}
          {!isDashboardsCollapsed && (
            <ResizablePane
              direction="vertical"
              onResize={(height) => {
                setViewHeight("dashboards", height);
              }}
              initialSize={viewHeights.dashboards}
              minSize={50}
              maxSize={800}
            />
          )}

          {/* Contexts View - Second */}
          {!isContextsCollapsed ? (
            <div
              style={{
                flexBasis: `${viewHeights.contexts}px`,
                flexShrink: 0,
                minHeight: "50px",
              }}
              className="overflow-hidden"
            >
              <CollapsibleView
                title="Contexts"
                isCollapsed={isContextsCollapsed}
                onToggleCollapse={() => toggleViewCollapse("contexts")}
                headerAccessory={
                  <button
                    type="button"
                    onClick={toggleContextScoping}
                    className={`flex items-center rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      contextScopeMode === "all"
                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                    title={
                      contextScopeMode === "all"
                        ? "Scoping: All workbooks (click to enable context scoping)"
                        : "Scoping: Active context only (click to disable)"
                    }
                    aria-label="Toggle context scoping"
                    data-testid={testIds.contexts.scopeToggle}
                  >
                    {contextScopeMode === "all" ? "ALL" : "SCOPED"}
                  </button>
                }
                actionButton={contextsActionButton}
                testId={testIds.sidebar.headers.contexts}
              >
                <ContextsView
                  onActionButton={setContextsActionButton}
                  onActiveContextChanged={handleActiveContextChanged}
                  scopeMode={contextScopeMode}
                />
              </CollapsibleView>
            </div>
          ) : (
            <div className="border-b border-gray-200">
              <CollapsibleView
                title="Contexts"
                isCollapsed={isContextsCollapsed}
                onToggleCollapse={() => toggleViewCollapse("contexts")}
                headerAccessory={
                  <button
                    type="button"
                    onClick={toggleContextScoping}
                    className={`flex items-center rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      contextScopeMode === "all"
                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                    title={
                      contextScopeMode === "all"
                        ? "Scoping: All workbooks (click to enable context scoping)"
                        : "Scoping: Active context only (click to disable)"
                    }
                    aria-label="Toggle context scoping"
                    data-testid={testIds.contexts.scopeToggle}
                  >
                    {contextScopeMode === "all" ? "ALL" : "SCOPED"}
                  </button>
                }
                actionButton={contextsActionButton}
                testId={testIds.sidebar.headers.contexts}
              >
                <div />
              </CollapsibleView>
            </div>
          )}

          {/* Resizable Separator between Contexts and Workbooks */}
          {!isContextsCollapsed && (
            <ResizablePane
              direction="vertical"
              onResize={(height) => {
                setViewHeight("contexts", height);
              }}
              initialSize={viewHeights.contexts}
              minSize={50}
              maxSize={800}
            />
          )}

          {/* Workbooks View - Third */}
          {!isWorkbooksCollapsed ? (
            <div
              style={{
                flexBasis: `${viewHeights.workbooks}px`,
                flexShrink: 0,
                minHeight: "50px",
              }}
              className="overflow-hidden"
            >
              <CollapsibleView
                title="Workbooks"
                isCollapsed={isWorkbooksCollapsed}
                onToggleCollapse={() => toggleViewCollapse("workbooks")}
                actionButton={workbooksHeaderActions}
                collapsedActionButton={workbooksSearchButton}
                testId={testIds.sidebar.headers.workbooks}
              >
                <WorkbooksView onActionButton={setWorkbookActionButton} />
              </CollapsibleView>
            </div>
          ) : (
            <div className="border-b border-gray-200">
              <CollapsibleView
                title="Workbooks"
                isCollapsed={isWorkbooksCollapsed}
                onToggleCollapse={() => toggleViewCollapse("workbooks")}
                actionButton={workbooksHeaderActions}
                collapsedActionButton={workbooksSearchButton}
                testId={testIds.sidebar.headers.workbooks}
              >
                <div />
              </CollapsibleView>
            </div>
          )}

          {/* Resizable Separator between Workbooks and Chat */}
          {/* Show separator if Workbooks is expanded (regardless of Chat state) */}
          {!isWorkbooksCollapsed && (
            <ResizablePane
              direction="vertical"
              onResize={(height) => {
                setViewHeight("workbooks", height);
              }}
              initialSize={viewHeights.workbooks}
              minSize={50}
              maxSize={800}
            />
          )}

          {/* Chat View - Fourth */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: isChatCollapsed ? "auto" : "50px" }}>
            <CollapsibleView
              title="Chat"
              isCollapsed={isChatCollapsed}
              onToggleCollapse={() => toggleViewCollapse("chat")}
              actionButton={chatActionButton}
              testId={testIds.sidebar.headers.chat}
            >
              <Chat chatKey="sidebar" onActionButton={setChatActionButton} onJumpToContexts={jumpToContexts} />
            </CollapsibleView>
          </div>
        </div>
      );
    }

    // Placeholder for other workbenches
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">{activeWorkbench?.name}</p>
          <p className="mt-2 text-xs text-gray-400">Coming soon</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50">
      <ToastCenter />
      {/* Activity Bar */}
      <ActivityBar />

      {/* Sidebar */}
      <div
        className="flex flex-col border-r border-gray-300 bg-white"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="border-b border-gray-200 px-3 py-2 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-700">insightLM-LT</h1>
            <button
              type="button"
              className="mt-0.5 w-full truncate text-left text-[10px] text-gray-500 hover:text-gray-700"
              onClick={jumpToContexts}
              title="Jump to Contexts"
              data-testid={testIds.sidebar.activeContextJump}
            >
              <span data-testid={testIds.sidebar.scopeText}>
                Scope:{" "}
                <span className="font-medium text-gray-700">
                  {contextScopeMode === "all"
                    ? "All workbooks"
                    : activeContextName
                      ? activeContextName
                      : "Active context"}
                </span>
              </span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`flex items-center rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                contextScopeMode === "all"
                  ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
              onClick={toggleContextScoping}
              title={
                contextScopeMode === "all"
                  ? "Scoping: All workbooks (click to enable context scoping)"
                  : "Scoping: Active context only (click to disable)"
              }
              aria-label="Toggle context scoping"
              data-testid={testIds.sidebar.scopeIndicator}
            >
              {contextScopeMode === "all" ? "ALL" : "SCOPED"}
            </button>
            <ExtensionToggle />
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          {renderWorkbenchContent()}
        </div>
      </div>

      {/* Horizontal Resizable Separator */}
      <ResizablePane
        direction="horizontal"
        onResize={setSidebarWidth}
        initialSize={sidebarWidth}
        minSize={200}
        maxSize={800}
      />

      {/* Main Content Area */}
      <div className="flex-1 bg-white">
        {openDocuments.length > 0 ? (
          <DocumentViewer documents={openDocuments} onClose={closeDocument} onJumpToContexts={jumpToContexts} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">Click a document to view it</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
