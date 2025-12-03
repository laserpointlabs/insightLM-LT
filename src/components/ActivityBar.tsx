type SidebarView = "workbooks" | "chat" | "dashboard";

interface ActivityBarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  return (
    <div className="flex flex-col border-r border-gray-300 bg-gray-50">
      <div className="flex flex-col p-1">
        <button
          onClick={() => onViewChange("workbooks")}
          className={`flex h-9 w-9 items-center justify-center transition-colors ${
            activeView === "workbooks"
              ? "bg-white text-blue-600 border-l-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
          title="Workbooks"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </button>
        <button
          onClick={() => onViewChange("chat")}
          className={`flex h-9 w-9 items-center justify-center transition-colors ${
            activeView === "chat"
              ? "bg-white text-blue-600 border-l-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
          title="Chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>
        <button
          onClick={() => onViewChange("dashboard")}
          className={`flex h-9 w-9 items-center justify-center transition-colors ${
            activeView === "dashboard"
              ? "bg-white text-blue-600 border-l-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
          title="Dashboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
