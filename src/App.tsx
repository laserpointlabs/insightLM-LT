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
import { SearchIcon } from "./components/Icons";

function App() {
  const [dashboardActionButton, setDashboardActionButton] = useState<React.ReactNode>(null);
  const [contextsActionButton, setContextsActionButton] = useState<React.ReactNode>(null);
  const [workbookActionButton, setWorkbookActionButton] = useState<React.ReactNode>(null);
  const [chatActionButton, setChatActionButton] = useState<React.ReactNode>(null);
  const [activeContextName, setActiveContextName] = useState<string | null>(null);
  const { openDocuments, closeDocument } = useDocumentStore();
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
                actionButton={contextsActionButton}
                testId={testIds.sidebar.headers.contexts}
              >
                <ContextsView
                  onActionButton={setContextsActionButton}
                  onActiveContextChanged={handleActiveContextChanged}
                />
              </CollapsibleView>
            </div>
          ) : (
            <div className="border-b border-gray-200">
              <CollapsibleView
                title="Contexts"
                isCollapsed={isContextsCollapsed}
                onToggleCollapse={() => toggleViewCollapse("contexts")}
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
              <Chat onActionButton={setChatActionButton} onJumpToContexts={jumpToContexts} />
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
            {activeContextName && (
              <button
                type="button"
                className="mt-0.5 w-full truncate text-left text-[10px] text-gray-500 hover:text-gray-700"
                onClick={jumpToContexts}
                title="Jump to Contexts"
                data-testid={testIds.sidebar.activeContextJump}
              >
                Active context:{" "}
                <span className="font-medium text-gray-700">{activeContextName}</span>
              </button>
            )}
          </div>
          <ExtensionToggle />
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
