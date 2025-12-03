import { ReactNode } from "react";

interface CollapsibleViewProps {
  title: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children: ReactNode;
}

export function CollapsibleView({
  title,
  isCollapsed,
  onToggleCollapse,
  children,
}: CollapsibleViewProps) {
  return (
    <div className="flex h-full flex-col border-b border-gray-200">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-2 py-1">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1 text-xs font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          {title}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden">{children}</div>
      )}
    </div>
  );
}
