import { useState, useEffect } from "react";
import { useDashboardStore } from "../../store/dashboardStore";
import { useDocumentStore } from "../../store/documentStore";
import { InputDialog } from "../InputDialog";
import { ConfirmDialog } from "../ConfirmDialog";

export function DashboardView() {
  const {
    dashboards,
    createDashboard,
    deleteDashboard,
    loadDashboards,
  } = useDashboardStore();
  const { openDocument } = useDocumentStore();
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    dashboardId: string;
  } | null>(null);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  const handleCreateDashboard = () => {
    setInputDialog({
      isOpen: true,
      title: "Create Dashboard",
      defaultValue: "",
      onConfirm: (name: string) => {
        setInputDialog({ ...inputDialog, isOpen: false });
        if (name.trim()) {
          const dashboard = createDashboard(name.trim());
          // Open the newly created dashboard
          handleDashboardClick(dashboard.id);
        }
      },
    });
  };

  const handleDashboardClick = (dashboardId: string) => {
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    if (dashboard) {
      openDocument({
        type: "dashboard",
        dashboardId: dashboard.id,
        filename: dashboard.name,
        content: "",
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, dashboardId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, dashboardId });
  };

  const handleDeleteDashboard = (dashboardId: string) => {
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    if (!dashboard) return;

    setConfirmDialog({
      isOpen: true,
      title: "Delete Dashboard",
      message: `Are you sure you want to delete "${dashboard.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: () => {
        deleteDashboard(dashboardId);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setContextMenu(null);
      },
    });
  };

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
    };
    if (contextMenu) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Dashboards</h2>
        <button
          onClick={handleCreateDashboard}
          className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
          title="Create New Dashboard"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {dashboards.length === 0 ? (
          <div className="mt-4 text-xs text-gray-500">
            No dashboards yet. Click + to create one.
          </div>
        ) : (
          dashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className="flex cursor-pointer items-center justify-between rounded p-1 hover:bg-gray-100"
              onClick={() => handleDashboardClick(dashboard.id)}
              onContextMenu={(e) => handleContextMenu(e, dashboard.id)}
            >
              <span className="flex items-center gap-1 text-sm">
                📊 {dashboard.name}
              </span>
              <span className="text-xs text-gray-400">
                {dashboard.queries.length} {dashboard.queries.length === 1 ? "query" : "queries"}
              </span>
            </div>
          ))
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 rounded border border-gray-200 bg-white shadow-lg"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleDeleteDashboard(contextMenu.dashboardId);
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
          >
            Delete Dashboard
          </button>
        </div>
      )}

      <InputDialog
        isOpen={inputDialog.isOpen}
        title={inputDialog.title}
        defaultValue={inputDialog.defaultValue}
        onConfirm={inputDialog.onConfirm}
        onCancel={() => setInputDialog({ ...inputDialog, isOpen: false })}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
