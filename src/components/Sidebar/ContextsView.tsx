import { useCallback, useEffect, useMemo, useState } from "react";
import { AddIcon, RefreshIcon } from "../Icons";
import { ConfirmDialog } from "../ConfirmDialog";
import { notifyError, notifySuccess } from "../../utils/notify";
import { testIds } from "../../testing/testIds";
import { setAutomationState } from "../../testing/automationState";

type ContextSummary = {
  id: string;
  name: string;
  workbook_ids: string[];
  folders?: string[] | null;
  created?: string;
  updated?: string;
};

type WorkbookSummary = { id: string; name: string; archived?: boolean };

interface ContextsViewProps {
  onActionButton?: (button: React.ReactNode) => void;
  onActiveContextChanged?: () => void;
  scopeMode?: "context" | "all";
}

export function ContextsView({
  onActionButton,
  onActiveContextChanged,
  scopeMode: initialScopeMode = "context",
}: ContextsViewProps = {}) {
  const [contexts, setContexts] = useState<ContextSummary[]>([]);
  const [activeContextId, setActiveContextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workbooks, setWorkbooks] = useState<WorkbookSummary[]>([]);
  const [scopeMode, setScopeMode] = useState<"context" | "all">(initialScopeMode);

  const [editor, setEditor] = useState<{
    isOpen: boolean;
    mode: "create" | "edit";
    contextId?: string;
    name: string;
    selectedWorkbookIds: Set<string>;
  }>({
    isOpen: false,
    mode: "create",
    name: "",
    selectedWorkbookIds: new Set(),
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

  const canUseMCP = !!window.electronAPI?.mcp?.call;
  const QUICK_WB_PREFIX = "[WB] ";

  // Keep in sync if parent-controlled scope changes (e.g. Chat chips).
  useEffect(() => {
    setScopeMode(initialScopeMode);
  }, [initialScopeMode]);

  const loadWorkbooks = useCallback(async () => {
    if (!window.electronAPI?.workbook) return;
    try {
      const all = await window.electronAPI.workbook.getAll();
      setWorkbooks((all || []).map((w: any) => ({ id: w.id, name: w.name, archived: w.archived })));
    } catch {
      // ignore; contexts can still render
    }
  }, []);

  const loadContexts = useCallback(async () => {
    if (!canUseMCP) {
      setError("MCP API not available");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const listRes = await window.electronAPI.mcp.call("context-manager", "tools/call", {
        name: "list_contexts",
        arguments: {},
      });
      const contextsList: ContextSummary[] = listRes?.contexts || [];
      setContexts(contextsList);

      const activeRes = await window.electronAPI.mcp.call("context-manager", "tools/call", {
        name: "get_active_context",
        arguments: {},
      });
      const activeId = activeRes?.active?.id ?? null;
      setActiveContextId(activeId);

      // Expose deterministic UI state for automation (so automation can map name -> id without async eval).
      setAutomationState({
        contexts: {
          activeContextId: activeId,
          contexts: (contextsList || []).map((c) => ({
            id: c.id,
            name: c.name,
            workbook_ids: c.workbook_ids || [],
          })),
          updatedAt: Date.now(),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contexts");
    } finally {
      setLoading(false);
    }
  }, [canUseMCP]);

  // NOTE: These must be defined AFTER loadContexts to avoid TDZ ("Cannot access before initialization").
  const isQuickWorkbookContext = useCallback((ctx: any): boolean => {
    try {
      if (!ctx) return false;
      const name = String(ctx?.name || "");
      const wbIds = Array.isArray(ctx?.workbook_ids) ? ctx.workbook_ids : [];
      const folders = ctx?.folders;
      const foldersEmpty = folders == null || (Array.isArray(folders) && folders.length === 0);
      return name.startsWith(QUICK_WB_PREFIX) && wbIds.length === 1 && foldersEmpty;
    } catch {
      return false;
    }
  }, []);

  const ensureQuickWorkbookContextActive = useCallback(
    async (workbook: { id: string; name: string }) => {
      if (!window.electronAPI?.mcp?.call) {
        notifyError("MCP unavailable", "Contexts");
        return;
      }

      const workbookId = String(workbook?.id || "");
      const workbookName = String(workbook?.name || workbookId);
      if (!workbookId) return;

      try {
        // Keep demos deterministic: ensure scoped mode when picking a workbook as a context.
        try {
          await window.electronAPI?.contextScope?.setMode?.("context");
          setScopeMode("context");
          window.dispatchEvent(new CustomEvent("context:scoping", { detail: { mode: "context" } }));
        } catch {
          // ignore
        }

        const listRes = await window.electronAPI.mcp.call("context-manager", "tools/call", {
          name: "list_contexts",
          arguments: {},
        });
        const contextsList: ContextSummary[] = Array.isArray(listRes?.contexts) ? listRes.contexts : [];

        // Find existing quick context for this workbook
        const existing = contextsList.find(
          (c: any) =>
            String(c?.name || "").startsWith(QUICK_WB_PREFIX) &&
            Array.isArray(c?.workbook_ids) &&
            c.workbook_ids.length === 1 &&
            String(c.workbook_ids[0]) === workbookId &&
            (c.folders == null || (Array.isArray(c.folders) && c.folders.length === 0)),
        );

        let ctxId: string | null = null;
        const desiredName = `${QUICK_WB_PREFIX}${workbookName}`;

        if (existing?.id) {
          ctxId = String(existing.id);
          // Keep name in sync with workbook name
          await window.electronAPI.mcp.call("context-manager", "tools/call", {
            name: "update_context",
            arguments: { context_id: ctxId, updates: { name: desiredName, workbook_ids: [workbookId], folders: null } },
          });
        } else {
          const created = await window.electronAPI.mcp.call("context-manager", "tools/call", {
            name: "create_context",
            arguments: { name: desiredName, workbook_ids: [workbookId], folders: null },
          });
          ctxId = created?.id ? String(created.id) : null;
        }

        if (ctxId) {
          await window.electronAPI.mcp.call("context-manager", "tools/call", {
            name: "activate_context",
            arguments: { context_id: ctxId },
          });
        }

        await loadContexts();
        onActiveContextChanged?.();
        window.dispatchEvent(new CustomEvent("context:changed"));
        notifySuccess(`Activated ${workbookName}`, "Contexts");
      } catch (e) {
        notifyError(e instanceof Error ? e.message : "Failed to activate workbook", "Contexts");
      }
    },
    [onActiveContextChanged, loadContexts],
  );

  useEffect(() => {
    loadWorkbooks();
    loadContexts();
  }, [loadWorkbooks, loadContexts]);

  const refreshScopeMode = useCallback(async () => {
    try {
      const modeRes = await window.electronAPI?.contextScope?.getMode?.();
      if (modeRes?.mode === "all" || modeRes?.mode === "context") {
        setScopeMode(modeRes.mode);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshScopeMode();
  }, [refreshScopeMode]);

  // Keep Contexts panel synced with other UI controls (e.g. Chat chips).
  useEffect(() => {
    const onChanged = () => {
      loadContexts();
    };
    const onScoping = () => {
      refreshScopeMode();
    };

    window.addEventListener("context:changed", onChanged as any);
    window.addEventListener("context:scoping", onScoping as any);
    return () => {
      window.removeEventListener("context:changed", onChanged as any);
      window.removeEventListener("context:scoping", onScoping as any);
    };
  }, [loadContexts, refreshScopeMode]);
  useEffect(() => {
    if (!onActionButton) return;
    onActionButton(
      <div className="flex items-center gap-0.5">
        <button
          onClick={async () => {
            const next = scopeMode === "context" ? "all" : "context";
            try {
              await window.electronAPI?.contextScope?.setMode?.(next);
              setScopeMode(next);
              window.dispatchEvent(new CustomEvent("context:scoping", { detail: { mode: next } }));
              notifySuccess(
                next === "all"
                  ? "Context scoping disabled (All workbooks)"
                  : "Context scoping enabled",
                "Contexts",
              );
              onActiveContextChanged?.();
            } catch (e) {
              notifyError(e instanceof Error ? e.message : "Failed to change scoping mode", "Contexts");
            }
          }}
          className="flex items-center justify-center rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          title={
            scopeMode === "all"
              ? "Scoping: All workbooks (click to enable context scoping)"
              : "Scoping: Active context (click to disable)"
          }
          aria-label="Toggle context scoping"
          data-testid={testIds.contexts.scopeToggle}
        >
          {scopeMode === "all" ? "All" : "Scoped"}
        </button>
        <button
          onClick={async () => {
            // Ensure workbook list is up-to-date (workbooks may have been created in this session).
            await loadWorkbooks();
            const selected = new Set<string>();
            setEditor({
              isOpen: true,
              mode: "create",
              name: "",
              selectedWorkbookIds: selected,
            });
          }}
          className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          title="Create Context"
          aria-label="Create Context"
          data-testid={testIds.contexts.create}
        >
          <AddIcon className="h-4 w-4" />
        </button>
        <button
          onClick={loadContexts}
          className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          title="Refresh Contexts"
          aria-label="Refresh Contexts"
          data-testid={testIds.contexts.refresh}
        >
          <RefreshIcon className="h-4 w-4" />
        </button>
      </div>,
    );
  }, [onActionButton, loadContexts]);

  const workbookNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workbooks) m.set(w.id, w.name);
    return m;
  }, [workbooks]);

  const quickWorkbooks = useMemo(() => {
    const arr = workbooks.filter((w) => !w.archived);
    arr.sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)));
    return arr;
  }, [workbooks]);

  const visibleContexts = useMemo(() => {
    // Hide auto-created single-workbook contexts from the main list to reduce clutter;
    // they are accessible through "Quick: Workbooks".
    return contexts.filter((c) => !isQuickWorkbookContext(c));
  }, [contexts, isQuickWorkbookContext]);

  const openEdit = async (ctx: ContextSummary) => {
    setEditor({
      isOpen: true,
      mode: "edit",
      contextId: ctx.id,
      name: ctx.name,
      selectedWorkbookIds: new Set(ctx.workbook_ids || []),
    });
  };

  const handleActivate = async (contextId: string) => {
    if (!canUseMCP) return;
    try {
      await window.electronAPI.mcp.call("context-manager", "tools/call", {
        name: "activate_context",
        arguments: { context_id: contextId },
      });
      await loadContexts();
      onActiveContextChanged?.();
      window.dispatchEvent(new CustomEvent("context:changed"));
      notifySuccess("Context activated", "Contexts");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to activate context", "Contexts");
    }
  };

  const handleDelete = async (ctx: ContextSummary) => {
    if (!canUseMCP) return;
    setConfirmDialog({
      isOpen: true,
      title: "Delete Context",
      message: `Delete context "${ctx.name}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setConfirmDialog((p) => ({ ...p, isOpen: false }));
        try {
          await window.electronAPI.mcp.call("context-manager", "tools/call", {
            name: "delete_context",
            arguments: { context_id: ctx.id },
          });
          await loadContexts();
          onActiveContextChanged?.();
          window.dispatchEvent(new CustomEvent("context:changed"));
          notifySuccess("Context deleted", "Contexts");
        } catch (e) {
          notifyError(e instanceof Error ? e.message : "Failed to delete context", "Contexts");
        }
      },
    });
  };

  const saveEditor = async () => {
    if (!canUseMCP) return;
    const name = editor.name.trim();
    const workbook_ids = Array.from(editor.selectedWorkbookIds);
    if (!name) {
      notifyError("Context name is required", "Contexts");
      return;
    }
    if (workbook_ids.length === 0) {
      notifyError("Select at least one workbook", "Contexts");
      return;
    }

    try {
      if (editor.mode === "create") {
        const created = await window.electronAPI.mcp.call("context-manager", "tools/call", {
          name: "create_context",
          arguments: { name, workbook_ids },
        });
        notifySuccess(`Context created (${created?.id || "unknown-id"})`, "Contexts");
      } else {
        const updated = await window.electronAPI.mcp.call("context-manager", "tools/call", {
          name: "update_context",
          arguments: { context_id: editor.contextId, updates: { name, workbook_ids } },
        });
        notifySuccess(`Context updated (${updated?.id || editor.contextId || "unknown-id"})`, "Contexts");
      }
      setEditor((p) => ({ ...p, isOpen: false }));
      await loadContexts();
      onActiveContextChanged?.();
      window.dispatchEvent(new CustomEvent("context:changed"));
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to save context", "Contexts");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2 text-[11px] text-gray-500" data-testid={testIds.contexts.scopeMode}>
          Scoping: {scopeMode === "all" ? "All workbooks" : "Active context only"}
        </div>
        {loading && <div className="text-sm text-gray-500">Loading...</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}

        {/* Quick single-workbook activation (no manual context creation needed) */}
        {quickWorkbooks.length > 0 && (
          <div className="mb-2 rounded border border-gray-200 bg-white p-2">
            <div className="mb-1 text-xs font-semibold text-gray-800">Quick: Workbooks</div>
            <div className="flex flex-col gap-1">
              {quickWorkbooks.slice(0, 12).map((wb) => (
                <button
                  key={wb.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => ensureQuickWorkbookContextActive({ id: wb.id, name: wb.name })}
                  title={`Activate workbook "${wb.name}"`}
                  data-testid={testIds.contexts.quickWorkbook(wb.id)}
                >
                  <span className="truncate">{wb.name}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">Workbook</span>
                </button>
              ))}
              {quickWorkbooks.length > 12 && (
                <div className="px-2 text-[10px] text-gray-400">+ {quickWorkbooks.length - 12} more…</div>
              )}
            </div>
          </div>
        )}

        {visibleContexts.length === 0 && !loading && (
          <div className="mt-4 text-sm text-gray-500">No contexts yet.</div>
        )}

        {visibleContexts.map((ctx) => {
          const isActive = ctx.id === activeContextId;
          return (
            <div
              key={ctx.id}
              data-testid={testIds.contexts.item(ctx.id)}
              className={`mb-1 rounded border px-2 py-1 ${isActive ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium text-gray-800">{ctx.name}</div>
                    {isActive && (
                      <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {ctx.workbook_ids?.length || 0} workbooks
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {!isActive && (
                    <button
                      className="rounded bg-blue-500 px-2 py-1 text-[11px] text-white hover:bg-blue-600"
                      onClick={() => handleActivate(ctx.id)}
                      title="Activate context"
                      aria-label={`Activate context ${ctx.name}`}
                      data-testid={testIds.contexts.activate(ctx.id)}
                      data-context-id={ctx.id}
                    >
                      Activate
                    </button>
                  )}
                  <button
                    className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                    onClick={() => openEdit(ctx)}
                    title="Edit context"
                    aria-label={`Edit context ${ctx.name}`}
                    data-testid={testIds.contexts.edit(ctx.id)}
                    data-context-id={ctx.id}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(ctx)}
                    title="Delete context"
                    aria-label={`Delete context ${ctx.name}`}
                    data-testid={testIds.contexts.delete(ctx.id)}
                    data-context-id={ctx.id}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                {(ctx.workbook_ids || []).slice(0, 6).map((wid) => (
                  <div key={wid} className="truncate text-[11px] text-gray-600">
                    - {workbookNameById.get(wid) || wid}
                  </div>
                ))}
                {(ctx.workbook_ids || []).length > 6 && (
                  <div className="text-[11px] text-gray-400">
                    + {(ctx.workbook_ids || []).length - 6} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editor.isOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditor((p) => ({ ...p, isOpen: false }))} />
          <div className="relative z-40 w-[520px] max-w-[90vw] rounded border border-gray-200 bg-white p-4 shadow-lg">
            <div className="mb-3 text-sm font-semibold text-gray-800">
              {editor.mode === "create" ? "Create Context" : "Edit Context"}
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editor.name}
                onChange={(e) => setEditor((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Aircraft Design"
                data-testid={testIds.contexts.modal.name}
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">Workbooks</label>
              <div className="max-h-[260px] overflow-auto rounded border border-gray-200 p-2">
                {workbooks.filter((w) => !w.archived).map((wb) => {
                  const checked = editor.selectedWorkbookIds.has(wb.id);
                  return (
                    <label key={wb.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setEditor((p) => {
                            const next = new Set(p.selectedWorkbookIds);
                            if (next.has(wb.id)) next.delete(wb.id);
                            else next.add(wb.id);
                            return { ...p, selectedWorkbookIds: next };
                          });
                        }}
                        data-testid={testIds.contexts.modal.workbookCheckbox}
                        data-workbook-id={wb.id}
                      />
                      <span className="truncate">{wb.name}</span>
                      <span className="ml-auto truncate text-[10px] text-gray-400">{wb.id}</span>
                    </label>
                  );
                })}
                {workbooks.filter((w) => !w.archived).length === 0 && (
                  <div className="text-xs text-gray-500">No workbooks available.</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className="rounded border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setEditor((p) => ({ ...p, isOpen: false }))}
                data-testid={testIds.contexts.modal.cancel}
              >
                Cancel
              </button>
              <button
                className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
                onClick={saveEditor}
                data-testid={testIds.contexts.modal.save}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}
      />
    </div>
  );
}
