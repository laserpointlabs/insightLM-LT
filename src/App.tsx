import { useState } from "react";
import { WorkbooksView } from "./components/Sidebar/WorkbooksView";
import { Chat } from "./components/Sidebar/Chat";
import { DocumentViewer } from "./components/DocumentViewer/DocumentViewer";
import { SimpleStats } from "./components/SimpleStats";
import { DashboardBuilder } from "./components/Dashboard/DashboardBuilder";
import { useDocumentStore } from "./store/documentStore";

function App() {
  const { openDocuments, closeDocument } = useDocumentStore();
  const [activeView, setActiveView] = useState<"documents" | "dashboard">(
    "documents",
  );

  return (
    <div className="flex h-screen w-screen bg-gray-50">
      <div className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-3">
          <h1 className="text-lg font-bold">insightLM-LT</h1>
        </div>
        <div className="flex gap-1 border-b border-gray-200 p-2">
          <button
            onClick={() => setActiveView("documents")}
            className={`flex-1 rounded px-2 py-1 text-xs ${
              activeView === "documents"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveView("dashboard")}
            className={`flex-1 rounded px-2 py-1 text-xs ${
              activeView === "dashboard"
                ? "bg-blue-500 text-white"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Dashboard
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <WorkbooksView />
          </div>
          <div className="flex h-64 flex-col border-t border-gray-200">
            <div className="flex-1 overflow-hidden">
              <Chat />
            </div>
            <SimpleStats />
          </div>
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="h-full rounded-lg border border-gray-200 bg-white shadow-sm">
          {activeView === "dashboard" ? (
            <DashboardBuilder />
          ) : openDocuments.length > 0 ? (
            <DocumentViewer documents={openDocuments} onClose={closeDocument} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-gray-500">Click a document to view it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
