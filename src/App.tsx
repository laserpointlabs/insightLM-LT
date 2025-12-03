import { useState } from "react";
import { WorkbooksView } from "./components/Sidebar/WorkbooksView";
import { Chat } from "./components/Sidebar/Chat";
import { DashboardView } from "./components/Sidebar/DashboardView";
import { DocumentViewer } from "./components/DocumentViewer/DocumentViewer";
import { ActivityBar } from "./components/ActivityBar";
import { CollapsibleView } from "./components/CollapsibleView";
import { ResizablePane } from "./components/ResizablePane";
import { useDocumentStore } from "./store/documentStore";
import { useLayoutStore } from "./store/layoutStore";
import { useWorkbenchStore } from "./store/workbenchStore";

function App() {
  const [dashboardActionButton, setDashboardActionButton] = useState<React.ReactNode>(null);
  const [workbookActionButton, setWorkbookActionButton] = useState<React.ReactNode>(null);
  const [chatActionButton, setChatActionButton] = useState<React.ReactNode>(null);
  const { openDocuments, closeDocument } = useDocumentStore();
  const {
    sidebarWidth,
    viewHeights,
    collapsedViews,
    setSidebarWidth,
    setViewHeight,
    toggleViewCollapse,
  } = useLayoutStore();
  const { activeWorkbenchId, workbenches } = useWorkbenchStore();

  const activeWorkbench = workbenches.find((w) => w.id === activeWorkbenchId);

  const renderWorkbenchContent = () => {
    // For Insight Workbench (file), show all views stacked vertically with resizing
    if (activeWorkbenchId === "file") {
      const isDashboardsCollapsed = collapsedViews.has("dashboards");
      const isWorkbooksCollapsed = collapsedViews.has("workbooks");
      const isChatCollapsed = collapsedViews.has("chat");

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
              >
                <div />
              </CollapsibleView>
            </div>
          )}

          {/* Resizable Separator between Dashboards and Workbooks */}
          {/* Show separator if Dashboards is expanded (regardless of Workbooks state) */}
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

          {/* Workbooks View - Second */}
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
                actionButton={workbookActionButton}
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
                actionButton={workbookActionButton}
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

          {/* Chat View - Third */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: isChatCollapsed ? "auto" : "50px" }}>
            <CollapsibleView
              title="Chat"
              isCollapsed={isChatCollapsed}
              onToggleCollapse={() => toggleViewCollapse("chat")}
              actionButton={chatActionButton}
            >
              <Chat onActionButton={setChatActionButton} />
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
      {/* Activity Bar */}
      <ActivityBar />

      {/* Sidebar */}
      <div
        className="flex flex-col border-r border-gray-300 bg-white"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="border-b border-gray-200 px-3 py-2">
          <h1 className="text-sm font-semibold text-gray-700">insightLM-LT</h1>
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
          <DocumentViewer documents={openDocuments} onClose={closeDocument} />
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
