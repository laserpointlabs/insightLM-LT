import { WorkbooksView } from "./components/Sidebar/WorkbooksView";
import { Chat } from "./components/Sidebar/Chat";
import { DashboardView } from "./components/Sidebar/DashboardView";
import { DocumentViewer } from "./components/DocumentViewer/DocumentViewer";
import { SimpleStats } from "./components/SimpleStats";
import { ActivityBar } from "./components/ActivityBar";
import { ResizablePane } from "./components/ResizablePane";
import { useDocumentStore } from "./store/documentStore";
import { useLayoutStore } from "./store/layoutStore";

function App() {
  const { openDocuments, closeDocument } = useDocumentStore();
  const {
    sidebarWidth,
    chatHeight,
    activeSidebarView,
    setSidebarWidth,
    setChatHeight,
    setActiveSidebarView,
  } = useLayoutStore();

  const renderSidebarView = () => {
    switch (activeSidebarView) {
      case "workbooks":
        return <WorkbooksView />;
      case "chat":
        return <Chat />;
      case "dashboard":
        return <DashboardView />;
      default:
        return <WorkbooksView />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50">
      {/* Activity Bar */}
      <ActivityBar
        activeView={activeSidebarView}
        onViewChange={setActiveSidebarView}
      />

      {/* Sidebar */}
      <div
        className="flex flex-col border-r border-gray-300 bg-white"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="border-b border-gray-200 px-3 py-2">
          <h1 className="text-sm font-semibold text-gray-700">insightLM-LT</h1>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          {renderSidebarView()}
          {activeSidebarView === "workbooks" && (
            <>
              {/* Vertical Resizable Separator */}
              <ResizablePane
                direction="vertical"
                onResize={setChatHeight}
                initialSize={chatHeight}
                minSize={150}
                maxSize={600}
              />

              {/* Chat and Stats Area */}
              <div
                className="flex flex-col border-t border-gray-200"
                style={{ height: `${chatHeight}px` }}
              >
                <div className="flex-1 overflow-hidden">
                  <Chat />
                </div>
                <SimpleStats />
              </div>
            </>
          )}
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
