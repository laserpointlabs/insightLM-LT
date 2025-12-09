import { useWorkbenchStore, WorkbenchView } from "../store/workbenchStore";

interface WorkbenchViewSwitcherProps {
  views: WorkbenchView[];
}

export function WorkbenchViewSwitcher({ views }: WorkbenchViewSwitcherProps) {
  const { activeView, setActiveView } = useWorkbenchStore();

  if (views.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1 border-b border-gray-200 px-2 py-1">
      {views.map((view) => (
        <button
          key={view}
          onClick={() => setActiveView(view)}
          className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
            activeView === view
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {view === "workbooks" && "Workbooks"}
          {view === "dashboards" && "Dashboards"}
          {view === "chat" && "Chat"}
        </button>
      ))}
    </div>
  );
}



















