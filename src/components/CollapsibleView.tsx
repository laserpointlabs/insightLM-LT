import { ReactNode } from "react";
import { ChevronRightIcon } from "./Icons";

interface CollapsibleViewProps {
  title: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children: ReactNode;
  /**
   * Header content shown on the right side even when collapsed.
   * Use this for persistent status indicators (e.g. Context scoping).
   */
  headerAccessory?: ReactNode;
  actionButton?: ReactNode;
  collapsedActionButton?: ReactNode;
  testId?: string;
  contentTestId?: string;
}

export function CollapsibleView({
  title,
  isCollapsed,
  onToggleCollapse,
  children,
  headerAccessory,
  actionButton,
  collapsedActionButton,
  testId,
  contentTestId,
}: CollapsibleViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col border-b border-gray-200">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-2 py-1">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1 text-xs font-semibold text-gray-700 uppercase tracking-wide hover:text-gray-900"
          data-testid={testId}
          aria-expanded={!isCollapsed}
        >
          <ChevronRightIcon
            className={`h-3 w-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
          />
          {title}
        </button>
        {(headerAccessory || actionButton || collapsedActionButton) && (
          <div className="flex items-center gap-0.5">
            {headerAccessory}
            {!isCollapsed ? actionButton : collapsedActionButton}
          </div>
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          data-testid={contentTestId}
        >
          {children}
        </div>
      )}
    </div>
  );
}
