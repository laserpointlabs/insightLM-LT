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
import { ToastCenter } from "./components/Notifications/ToastCenter";
import { initAutomationUI } from "./testing/automationUi";
import { testIds } from "./testing/testIds";
import { notifyError, notifyInfo, notifySuccess } from "./utils/notify";
import { SearchIcon } from "./components/Icons";
import { StatusBar } from "./components/StatusBar";
import { ExtensionsWorkbench } from "./components/Extensions/ExtensionsWorkbench";

function App() {
  const [dashboardActionButton, setDashboardActionButton] = useState<React.ReactNode>(null);
  const [contextsActionButton, setContextsActionButton] = useState<React.ReactNode>(null);
  const [workbookActionButton, setWorkbookActionButton] = useState<React.ReactNode>(null);
  const [chatActionButton, setChatActionButton] = useState<React.ReactNode>(null);
  const [activeContextName, setActiveContextName] = useState<string | null>(null);
  const [contextScopeMode, setContextScopeMode] = useState<"all" | "context">("context");
  const [projectLabel, setProjectLabel] = useState<string>("Project");
  const [projectDataDir, setProjectDataDir] = useState<string>("");
  const { openDocuments, closeDocument, openDocument, refreshOpenDocumentsForWorkbook } = useDocumentStore();
  const {
    sidebarWidth,
    chatHeight,
    viewHeights,
    collapsedViews,
    setSidebarWidth,
    setChatHeight,
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
    let cancelled = false;
    const run = async () => {
      try {
        // Mark restore-in-progress so tab persistence doesn't overwrite the intended restored active tab.
        try {
          (window as any).__insightlmRestoringTabs = true;
        } catch {
          // ignore
        }

        const raw = localStorage.getItem("insightlm.openTabs.v1");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        // Restore tabs sequentially so active-tab restoration is deterministic.
        for (const t of parsed) {
          if (cancelled) return;
          const type = String(t?.type || "");
          if (type === "chat") {
            const chatKey = String(t?.chatKey || "main").trim() || "main";
            const filename = String(t?.filename || "Chat").trim() || "Chat";
            await openDocument({ type: "chat", chatKey, filename } as any);
            continue;
          }
          if (type === "document") {
            const workbookId = String(t?.workbookId || "").trim();
            const p = String(t?.path || "").trim();
            if (!workbookId || !p) continue;
            const filename = String(t?.filename || p.split("/").pop() || p).trim() || (p.split("/").pop() || p);
            await openDocument({ workbookId, path: p, filename } as any);
            continue;
          }
          if (type === "dashboard") {
            const dashboardId = String(t?.dashboardId || "").trim();
            if (!dashboardId) continue;
            const filename = String(t?.filename || "Dashboard").trim() || "Dashboard";
            await openDocument({ type: "dashboard", dashboardId, filename } as any);
            continue;
          }
          if (type === "config") {
            const configKey = String(t?.configKey || "").trim();
            if (!configKey) continue;
            const filename = String(t?.filename || "config").trim() || "config";
            await openDocument({ type: "config", configKey, filename } as any);
            continue;
          }
          if (type === "extension") {
            const extensionId = String(t?.extensionId || "").trim();
            if (!extensionId) continue;
            const filename = String(t?.filename || "Extension").trim() || "Extension";
            await openDocument({ type: "extension", extensionId, filename } as any);
            continue;
          }
        }

        // Restore the active tab (project-scoped, disk-backed) after all tabs exist.
        const st = await window.electronAPI?.projectState?.get?.();
        const a: any = st?.activeTab;
        const at = String(a?.type || "");
        if (at === "chat") {
          const chatKey = String(a?.chatKey || "main").trim() || "main";
          await openDocument({ type: "chat", chatKey, filename: "Chat" } as any);
        } else if (at === "document") {
          const workbookId = String(a?.workbookId || "").trim();
          const p = String(a?.path || "").trim();
          if (workbookId && p) {
            const filename = p.split("/").pop() || p;
            await openDocument({ workbookId, path: p, filename } as any);
          }
        } else if (at === "dashboard") {
          const dashboardId = String(a?.dashboardId || "").trim();
          if (dashboardId) {
            await openDocument({ type: "dashboard", dashboardId, filename: "Dashboard" } as any);
          }
        } else if (at === "config") {
          const configKey = String(a?.configKey || "").trim();
          if (configKey) {
            await openDocument({ type: "config", configKey, filename: "config" } as any);
          }
        }
      } catch {
        // ignore
      } finally {
        try {
          (window as any).__insightlmRestoringTabs = false;
        } catch {
          // ignore
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [openDocument]);

  // Lightweight automation mode: bots can force-show hover-only controls via `window.__insightlmAutomationUI.setMode(true)`.
  useEffect(() => {
    return initAutomationUI();
  }, []);

  // Bridge main-process workbooks/file change notifications into DOM events (for view auto-refresh),
  // and invalidate workbook-rag cache so new/edited files become queryable immediately.
  useEffect(() => {
    const offChanged = window.electronAPI?.events?.onWorkbooksChanged?.(() => {
      try {
        window.dispatchEvent(new CustomEvent("workbooks:changed"));
      } catch {
        // ignore
      }
      // Best-effort global cache clear (directory stamp lag on Windows can otherwise cause stale RAG results).
      (async () => {
        try {
          if (!window.electronAPI?.mcp?.call) return;
          await window.electronAPI.mcp.call("workbook-rag", "tools/call", {
            name: "rag_clear_cache",
            arguments: {},
          });
        } catch {
          // ignore
        }
      })();
    });

    const offFiles = window.electronAPI?.events?.onWorkbookFilesChanged?.((payload: any) => {
      const workbookId = String(payload?.workbookId || "").trim();
      try {
        window.dispatchEvent(new CustomEvent("workbooks:changed"));
      } catch {
        // ignore
      }
      try {
        window.dispatchEvent(new CustomEvent("workbooks:filesChanged", { detail: { workbookId } }));
      } catch {
        // ignore
      }
      (async () => {
        try {
          if (!window.electronAPI?.mcp?.call) return;
          await window.electronAPI.mcp.call("workbook-rag", "tools/call", {
            name: "rag_clear_cache",
            arguments: workbookId ? { workbook_id: workbookId } : {},
          });
        } catch {
          // ignore
        }
      })();

      // If a file was changed on disk (often by Chat/tools), refresh any open tabs in that workbook.
      // Never stomp user edits: skip dirty tabs and surface a non-blocking info toast.
      (async () => {
        try {
          if (!workbookId) return;
          const res = await refreshOpenDocumentsForWorkbook(workbookId);
          if (res?.skippedDirty) {
            notifyInfo(
              "Some open files changed on disk, but you have unsaved edits—skipping auto-reload for those tabs.",
              "Files changed",
            );
          }
        } catch {
          // ignore
        }
      })();
    });

    return () => {
      try {
        offChanged?.();
      } catch {
        // ignore
      }
      try {
        offFiles?.();
      } catch {
        // ignore
      }
    };
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

  // Project indicator (workspace-like): show the current Project name derived from dataDir.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await window.electronAPI?.project?.getCurrent?.();
        const dataDir = String(res?.dataDir || "").trim();
        const base = dataDir
          ? dataDir.replace(/\\/g, "/").split("/").filter(Boolean).pop() || "Project"
          : "Project";
        if (!cancelled) {
          setProjectDataDir(dataDir);
          setProjectLabel(base);
        }
      } catch {
        if (!cancelled) {
          setProjectDataDir("");
          setProjectLabel("Project");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
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

  // Fail-soft: allow components that don't receive the callback prop (or where it is temporarily undefined)
  // to request a jump to Contexts via a window event.
  useEffect(() => {
    const onJump = () => {
      try {
        jumpToContexts();
      } catch {
        // ignore
      }
    };
    window.addEventListener("insightlm:jumpToContexts", onJump as any);
    return () => window.removeEventListener("insightlm:jumpToContexts", onJump as any);
  }, [jumpToContexts]);

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

      const dashboardsHeaderAccessory = undefined;
      const contextsHeaderAccessory = (
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
      );

      return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {(() => {
            // Stable view order: Dashboards → Contexts → Workbooks → Chat (no reordering / no "jump to top").
            // Split sizing model: preferred heights, allow shrink, last expanded non-chat view grows to fill remainder.
            const expandedNonChat: Array<"dashboards" | "contexts" | "workbooks"> = [];
            if (!isDashboardsCollapsed) expandedNonChat.push("dashboards");
            if (!isContextsCollapsed) expandedNonChat.push("contexts");
            if (!isWorkbooksCollapsed) expandedNonChat.push("workbooks");
            const lastExpandedNonChat = expandedNonChat.length ? expandedNonChat[expandedNonChat.length - 1] : null;

            const nonChatStyle = (viewId: "dashboards" | "contexts" | "workbooks") => {
              if (collapsedViews.has(viewId)) return { flex: "0 0 auto" as const };
              const base = {
                minHeight: "50px",
                flexBasis: `${viewHeights[viewId]}px`,
                flexShrink: 1,
                flexGrow: 0,
              } as const;
              if (viewId === lastExpandedNonChat) return { ...base, flexGrow: 1 };
              return base;
            };

            const showDashboardsSeparator = !isDashboardsCollapsed && (!isContextsCollapsed || !isWorkbooksCollapsed);
            const showContextsSeparator = !isContextsCollapsed && !isWorkbooksCollapsed;

            const chatStyle = isChatCollapsed
              ? ({ flex: "0 0 auto" as const, minHeight: "28px" })
              : ({
                  minHeight: "150px",
                  flexBasis: `${chatHeight}px`,
                  flexShrink: 1,
                  flexGrow: 0,
                } as const);

            return (
              <>
                {/* Non-chat stack is scroll-first under constrained space. */}
                <div
                  className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
                  data-testid={testIds.sidebar.viewsScroll}
                >
                  <div
                    style={nonChatStyle("dashboards")}
                    className="min-h-0 overflow-hidden"
                    data-testid={testIds.sidebar.view.dashboards}
                  >
                    <CollapsibleView
                      title="Dashboards"
                      isCollapsed={isDashboardsCollapsed}
                      onToggleCollapse={() => toggleViewCollapse("dashboards")}
                      actionButton={dashboardActionButton}
                      headerAccessory={dashboardsHeaderAccessory}
                      testId={testIds.sidebar.headers.dashboards}
                      contentTestId={testIds.sidebar.viewBody.dashboards}
                    >
                      <DashboardView onActionButton={setDashboardActionButton} />
                    </CollapsibleView>
                  </div>

                  {showDashboardsSeparator && (
                    <ResizablePane
                      direction="vertical"
                      onResize={(height) => setViewHeight("dashboards", height)}
                      initialSize={viewHeights.dashboards}
                      minSize={50}
                      maxSize={1000}
                    />
                  )}

                  <div
                    style={nonChatStyle("contexts")}
                    className="min-h-0 overflow-hidden"
                    data-testid={testIds.sidebar.view.contexts}
                  >
                    <CollapsibleView
                      title="Contexts"
                      isCollapsed={isContextsCollapsed}
                      onToggleCollapse={() => toggleViewCollapse("contexts")}
                      headerAccessory={contextsHeaderAccessory}
                      actionButton={contextsActionButton}
                      testId={testIds.sidebar.headers.contexts}
                      contentTestId={testIds.sidebar.viewBody.contexts}
                    >
                      <ContextsView
                        onActionButton={setContextsActionButton}
                        onActiveContextChanged={handleActiveContextChanged}
                        scopeMode={contextScopeMode}
                      />
                    </CollapsibleView>
                  </div>

                  {showContextsSeparator && (
                    <ResizablePane
                      direction="vertical"
                      onResize={(height) => setViewHeight("contexts", height)}
                      initialSize={viewHeights.contexts}
                      minSize={50}
                      maxSize={1000}
                    />
                  )}

                  <div
                    style={nonChatStyle("workbooks")}
                    className="min-h-0 overflow-hidden"
                    data-testid={testIds.sidebar.view.workbooks}
                  >
                    <CollapsibleView
                      title="Workbooks"
                      isCollapsed={isWorkbooksCollapsed}
                      onToggleCollapse={() => toggleViewCollapse("workbooks")}
                      actionButton={workbooksHeaderActions}
                      collapsedActionButton={workbooksSearchButton}
                      testId={testIds.sidebar.headers.workbooks}
                      contentTestId={testIds.sidebar.viewBody.workbooks}
                    >
                      <WorkbooksView onActionButton={setWorkbookActionButton} />
                    </CollapsibleView>
                  </div>
                </div>

                {/* Chat height resizer (works regardless of which other views are collapsed). */}
                {!isChatCollapsed && (
                  <ResizablePane
                    direction="vertical"
                    invert
                    onResize={(h) => setChatHeight(h)}
                    initialSize={chatHeight}
                    minSize={150}
                    maxSize={600}
                  />
                )}

                <div style={chatStyle} className="flex-shrink-0 min-h-0 overflow-hidden" data-testid={testIds.sidebar.view.chat}>
                  <CollapsibleView
                    title="Chat"
                    isCollapsed={isChatCollapsed}
                    onToggleCollapse={() => toggleViewCollapse("chat")}
                    actionButton={chatActionButton}
                    testId={testIds.sidebar.headers.chat}
                    contentTestId={testIds.sidebar.viewBody.chat}
                  >
                    <Chat chatKey="sidebar" onActionButton={setChatActionButton} onJumpToContexts={jumpToContexts} />
                  </CollapsibleView>
                </div>
              </>
            );
          })()}
        </div>
      );
    }

    // Extensions workbench: list extensions and open details in main editor tabs.
    if (activeWorkbenchId === "extensions") {
      return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <ExtensionsWorkbench
            onOpenDetails={(extensionId) => {
              const m = extensionRegistry.getExtension(extensionId);
              const filename = m?.name ? `${m.name}` : "Extension";
              openDocument({ type: "extension", extensionId: String(extensionId || ""), filename } as any);
            }}
          />
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
    <div className="flex h-screen w-screen flex-col bg-gray-50">
      <ToastCenter />
      <div className="flex min-h-0 flex-1">
        {/* Activity Bar */}
        <ActivityBar />

        {/* Sidebar */}
        <div
          className="flex flex-col border-r border-gray-300 bg-white overflow-x-hidden"
          style={{ width: `${sidebarWidth}px` }}
          data-testid={testIds.sidebar.container}
        >
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
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

      <StatusBar
        projectLabel={projectLabel}
        projectDataDir={projectDataDir}
        scopeMode={contextScopeMode}
        activeContextName={activeContextName}
        onToggleScope={() => {
          toggleContextScoping().catch((e) => {
            notifyError(e instanceof Error ? e.message : "Failed to toggle scope", "Scope");
          });
        }}
        onJumpToContexts={jumpToContexts}
      />
    </div>
  );
}

export default App;
