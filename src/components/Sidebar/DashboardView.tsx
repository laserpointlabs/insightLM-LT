import { useState, useEffect, useCallback } from "react";
import { useDashboardStore } from "../../store/dashboardStore";
import { useDocumentStore } from "../../store/documentStore";
import { InputDialog } from "../InputDialog";
import { ConfirmDialog } from "../ConfirmDialog";
import { AddIcon } from "../Icons";
import { notifyError, notifySuccess } from "../../utils/notify";

interface DashboardViewProps {
  onActionButton?: (button: React.ReactNode) => void;
}

export function DashboardView({ onActionButton }: DashboardViewProps = {}) {
  const {
    dashboards,
    createDashboard,
    renameDashboard,
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

  const handleDashboardClick = useCallback((dashboardId: string) => {
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    if (dashboard) {
      openDocument({
        type: "dashboard",
        dashboardId: dashboard.id,
        filename: dashboard.name,
        content: "",
      });
    }
  }, [dashboards, openDocument]);

  const openDashboard = useCallback((dashboard: { id: string; name: string }) => {
    openDocument({
      type: "dashboard",
      dashboardId: dashboard.id,
      filename: dashboard.name,
      content: "",
    });
  }, [openDocument]);

  const handleCreateDashboard = useCallback(() => {
    setInputDialog({
      isOpen: true,
      title: "Create Dashboard",
      defaultValue: "",
      onConfirm: async (name: string) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        if (name.trim()) {
          try {
            const dashboard = await createDashboard(name.trim());
            // Open the newly created dashboard directly without looking it up
            openDashboard(dashboard);
            notifySuccess(`Dashboard "${name.trim()}" created`, "Dashboards");
          } catch (error) {
            console.error("Failed to create dashboard:", error);
            notifyError(
              error instanceof Error ? error.message : "Failed to create dashboard",
              "Dashboards",
            );
          }
        }
      },
    });
  }, [createDashboard, openDashboard]);

  useEffect(() => {
    if (onActionButton) {
      onActionButton(
        <button
          onClick={handleCreateDashboard}
          className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          title="Create New Dashboard"
        >
          <AddIcon className="h-4 w-4" />
        </button>
      );
    }
  }, [onActionButton, handleCreateDashboard]);


  const handleContextMenu = (e: React.MouseEvent, dashboardId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, dashboardId });
  };

  const handleRenameDashboard = (dashboardId: string) => {
    const dashboard = dashboards.find((d) => d.id === dashboardId);
    if (!dashboard) return;

    setContextMenu(null);

    setInputDialog({
      isOpen: true,
      title: "Rename Dashboard",
      defaultValue: dashboard.name,
      onConfirm: async (newName: string) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        if (!newName.trim() || newName.trim() === dashboard.name) return;

        try {
          await renameDashboard(dashboardId, newName.trim());
          notifySuccess("Dashboard renamed", "Dashboards");
        } catch (error) {
          console.error("Failed to rename dashboard:", error);
          notifyError(
            error instanceof Error ? error.message : "Failed to rename dashboard",
            "Dashboards",
          );
        }
      },
    });
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
      onConfirm: async () => {
        try {
          await deleteDashboard(dashboardId);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          setContextMenu(null);
          notifySuccess("Dashboard deleted", "Dashboards");
        } catch (error) {
          console.error("Failed to delete dashboard:", error);
          notifyError(
            error instanceof Error ? error.message : "Failed to delete dashboard",
            "Dashboards",
          );
        }
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
              handleRenameDashboard(contextMenu.dashboardId);
            }}
            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            Rename Dashboard
          </button>
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
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
