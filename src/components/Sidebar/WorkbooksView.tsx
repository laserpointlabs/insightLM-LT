import { useEffect, useState, useCallback } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { ConfirmDialog } from "../ConfirmDialog";
import { InputDialog } from "../InputDialog";
import { AddIcon, RefreshIcon, CollapseAllIcon, FileIcon, FolderIcon, DeleteIcon } from "../Icons";
import { extensionRegistry } from "../../services/extensionRegistry";
import { WorkbookActionContribution } from "../../types";
import { notifyError, notifyInfo, notifySuccess } from "../../utils/notify";
import { MoveFolderDialog } from "../MoveFolderDialog";
import { MoveDocumentDialog } from "../MoveDocumentDialog";
import { testIds } from "../../testing/testIds";

interface WorkbooksViewProps {
  onActionButton?: (button: React.ReactNode) => void;
}

type DragDocPayload = {
  kind: "doc";
  workbookId: string;
  relativePath: string;
  filename: string;
};

type DragFolderPayload = {
  kind: "folder";
  workbookId: string;
  folderName: string;
};

export function WorkbooksView({ onActionButton }: WorkbooksViewProps = {}) {
  const { workbooks, setWorkbooks, loading, setLoading, error, setError } =
    useWorkbookStore();
  const [workbookActions, setWorkbookActions] = useState<WorkbookActionContribution[]>(extensionRegistry.getWorkbookActions());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    workbookId: string;
  } | null>(null);
  const [documentContextMenu, setDocumentContextMenu] = useState<{
    x: number;
    y: number;
    workbookId: string;
    documentPath: string;
    documentName: string;
  } | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number;
    y: number;
    workbookId: string;
    folderName: string;
  } | null>(null);
  const [moveFolderDialog, setMoveFolderDialog] = useState<{
    isOpen: boolean;
    sourceWorkbookId: string;
    sourceFolderName: string;
  }>({ isOpen: false, sourceWorkbookId: "", sourceFolderName: "" });
  const [moveDocDialog, setMoveDocDialog] = useState<{
    isOpen: boolean;
    sourceWorkbookId: string;
    sourceRelativePath: string;
    sourceFilename: string;
  }>({ isOpen: false, sourceWorkbookId: "", sourceRelativePath: "", sourceFilename: "" });
  const [expandedWorkbooks, setExpandedWorkbooks] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [forceVisibleControls, setForceVisibleControls] = useState<boolean>(
    typeof document !== "undefined" && document.body?.dataset?.automationMode === "true",
  );
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

  const DOC_DRAG_MIME = "application/x-insightlm-doc";
  const FOLDER_DRAG_MIME = "application/x-insightlm-folder";
  const getDocRelativePath = (doc: any): string => {
    const p = typeof doc?.path === "string" ? doc.path.replace(/\\/g, "/") : "";
    if (p) return p;
    const filename = String(doc?.filename || "").trim();
    const folder = String(doc?.folder || "").trim();
    if (!filename) return "";
    return folder ? `documents/${folder}/${filename}` : `documents/${filename}`;
  };
  const readDocDragPayload = (dt: DataTransfer): DragDocPayload | null => {
    try {
      const raw = dt.getData(DOC_DRAG_MIME);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.kind === "doc" &&
        typeof parsed.workbookId === "string" &&
        typeof parsed.relativePath === "string" &&
        typeof parsed.filename === "string"
      ) {
        return parsed as DragDocPayload;
      }
      return null;
    } catch {
      return null;
    }
  };

  const readFolderDragPayload = (dt: DataTransfer): DragFolderPayload | null => {
    try {
      const raw = dt.getData(FOLDER_DRAG_MIME);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.kind === "folder" &&
        typeof parsed.workbookId === "string" &&
        typeof parsed.folderName === "string"
      ) {
        return parsed as DragFolderPayload;
      }
      return null;
    } catch {
      return null;
    }
  };

  const [draggingDoc, setDraggingDoc] = useState<DragDocPayload | null>(null);
  const [draggingFolder, setDraggingFolder] = useState<DragFolderPayload | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<
    | null
    | { kind: "workbook"; workbookId: string }
    | { kind: "folder"; workbookId: string; folderName: string }
  >(null);

  const loadWorkbooks = useCallback(async () => {
    if (!window.electronAPI?.workbook) {
      setError("Electron API not available");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const allWorkbooks = await window.electronAPI.workbook.getAll();
      // Ensure we have an array and normalize the data structure
      if (Array.isArray(allWorkbooks)) {
        const normalized = allWorkbooks.map((w: any) => ({
          ...w,
          archived: w.archived ?? false,
          documents: Array.isArray(w.documents)
            ? w.documents.map((d: any) => ({
                ...d,
                archived: d.archived ?? false,
              }))
            : [],
        }));
        setWorkbooks(normalized);
      } else {
        setWorkbooks([]);
      }
    } catch (err) {
      console.error("Failed to load workbooks:", err);
      setError(err instanceof Error ? err.message : "Failed to load workbooks");
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setWorkbooks]);

  const performMoveFolder = useCallback(
    async (
      sourceWorkbookId: string,
      sourceFolderName: string,
      targetWorkbookId: string,
      targetFolderName: string,
    ) => {
      if (!window.electronAPI?.workbook || !window.electronAPI?.file) {
        notifyError("Electron API not available", "Workbooks");
        return;
      }

      const fromFolder = (sourceFolderName || "").trim();
      const toFolder = (targetFolderName || "").trim();
      if (!fromFolder || !toFolder) return;

      try {
        const sourceWb = await window.electronAPI.workbook.get(sourceWorkbookId);
        const docs = Array.isArray(sourceWb?.documents) ? sourceWb.documents : [];

        const inFolder = docs.filter((d: any) => {
          if (d?.folder === fromFolder) return true;
          const p = typeof d?.path === "string" ? d.path.replace(/\\/g, "/") : "";
          return p.startsWith(`documents/${fromFolder}/`);
        });

        // Ensure target folder exists (create if missing)
        const targetWb = await window.electronAPI.workbook.get(targetWorkbookId);
        const folderNames: string[] = Array.isArray(targetWb?.folders) ? targetWb.folders : [];
        if (!folderNames.includes(toFolder) && window.electronAPI.workbook.createFolder) {
          await window.electronAPI.workbook.createFolder(targetWorkbookId, toFolder);
        }

        let moved = 0;
        let failed = 0;
        for (const doc of inFolder) {
          try {
            const rel = getDocRelativePath(doc);
            if (!rel) continue;
            await window.electronAPI.file.moveToFolder(
              sourceWorkbookId,
              rel,
              targetWorkbookId,
              toFolder,
            );
            moved++;
          } catch (err) {
            failed++;
            console.error("Failed to move doc during folder move:", err);
          }
        }

        // Remove source folder (now should be empty)
        if (window.electronAPI.workbook.deleteFolder) {
          await window.electronAPI.workbook.deleteFolder(sourceWorkbookId, fromFolder);
        }

        await loadWorkbooks();
        setExpandedWorkbooks((prev) => new Set(prev).add(targetWorkbookId));
        setExpandedFolders((prev) => new Set(prev).add(`${targetWorkbookId}::${toFolder}`));

        if (failed === 0) notifySuccess(`Moved folder "${fromFolder}" to workbook`, "Workbooks");
        else notifyInfo(`Moved folder "${fromFolder}" (moved ${moved}, ${failed} failed)`, "Workbooks");
      } catch (err) {
        notifyError(err instanceof Error ? err.message : "Failed to move folder", "Workbooks");
      }
    },
    [loadWorkbooks],
  );

  const handleMoveFolder = useCallback(
    async (sourceWorkbookId: string, folderName: string, targetWorkbookId: string) => {
      if (!window.electronAPI?.workbook) {
        notifyError("Electron API not available", "Workbooks");
        return;
      }

      const fromFolder = (folderName || "").trim();
      if (!fromFolder) return;

      const targetWb = await window.electronAPI.workbook.get(targetWorkbookId);
      const folderNames: string[] = Array.isArray(targetWb?.folders) ? targetWb.folders : [];

      // Collision handling: prompt for new folder name
      if (folderNames.includes(fromFolder)) {
        const suggested = `${fromFolder}-moved`;
        setInputDialog({
          isOpen: true,
          title: `Folder exists in target workbook — choose a new name`,
          defaultValue: suggested,
          onConfirm: async (newName: string) => {
            setInputDialog((prev) => ({ ...prev, isOpen: false }));
            const toFolder = (newName || "").trim();
            if (!toFolder) return;
            await performMoveFolder(sourceWorkbookId, fromFolder, targetWorkbookId, toFolder);
          },
        });
        return;
      }

      await performMoveFolder(sourceWorkbookId, fromFolder, targetWorkbookId, fromFolder);
    },
    [performMoveFolder],
  );

  useEffect(() => {
    // Wait for electronAPI to be available
    if (window.electronAPI) {
      loadWorkbooks();
    } else {
      // Retry after a short delay if electronAPI isn't ready yet
      const timer = setTimeout(() => {
        if (window.electronAPI) {
          loadWorkbooks();
        } else {
          setError("Electron API not available");
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loadWorkbooks, setError]);

  useEffect(() => {
    const update = () => {
      setForceVisibleControls(document.body?.dataset?.automationMode === "true");
    };
    update();
    window.addEventListener("automation:mode", update as any);
    return () => window.removeEventListener("automation:mode", update as any);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, workbookId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, workbookId });
  };

  const handleCreateWorkbook = useCallback(() => {
    if (!window.electronAPI?.workbook) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    setInputDialog({
      isOpen: true,
      title: "Create Workbook",
      defaultValue: "",
      onConfirm: async (name: string) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await window.electronAPI.workbook.create(name);
          await loadWorkbooks();
          notifySuccess(`Workbook "${name}" created`, "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to create workbook", "Workbooks");
        }
      },
    });
  }, [loadWorkbooks]);

  const handleRefreshWorkbooks = useCallback(async () => {
    await loadWorkbooks();
  }, [loadWorkbooks]);

  const handleCollapseAll = useCallback(() => {
    setExpandedWorkbooks(new Set());
  }, []);

  useEffect(() => {
    const updateActions = () => setWorkbookActions(extensionRegistry.getWorkbookActions());
    updateActions();
    const unsubscribe = extensionRegistry.subscribe(updateActions);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (onActionButton) {
      onActionButton(
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleCreateWorkbook}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Create New Workbook"
          >
            <AddIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleRefreshWorkbooks}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Refresh Workbooks"
          >
            <RefreshIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleCollapseAll}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Collapse All"
          >
            <CollapseAllIcon className="h-4 w-4" />
          </button>
        </div>
      );
    }
  }, [onActionButton, handleCreateWorkbook, handleRefreshWorkbooks, handleCollapseAll]);

  const handleRenameWorkbook = (workbookId: string) => {
    if (!window.electronAPI?.workbook) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    const workbook = workbooks.find((w) => w.id === workbookId);
    setContextMenu(null);

    setInputDialog({
      isOpen: true,
      title: "Rename Workbook",
      defaultValue: workbook?.name || "",
      onConfirm: async (newName: string) => {
        setInputDialog({ ...inputDialog, isOpen: false });
        if (!newName || newName === workbook?.name) return;

        try {
          await window.electronAPI.workbook.rename(workbookId, newName);
          await loadWorkbooks();
          notifySuccess("Workbook renamed", "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to rename workbook", "Workbooks");
        }
      },
    });
  };

  const handleDeleteWorkbook = (workbookId: string) => {
    if (!window.electronAPI?.workbook) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    setContextMenu(null);

    setConfirmDialog({
      isOpen: true,
      title: "Delete Workbook",
      message:
        "Are you sure you want to delete this workbook? This action cannot be undone.",
      confirmText: "Delete",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        try {
          await window.electronAPI.workbook.delete(workbookId);
          await loadWorkbooks();
          notifySuccess("Workbook deleted", "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to delete workbook", "Workbooks");
        }
      },
    });
  };

  const handleArchiveWorkbook = async (workbookId: string) => {
    if (!window.electronAPI?.archive) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    try {
      await window.electronAPI.archive.workbook(workbookId);
      await loadWorkbooks();
      notifySuccess("Workbook archived", "Workbooks");
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Failed to archive workbook", "Workbooks");
    }
    setContextMenu(null);
  };

  const { openDocument } = useDocumentStore();

  const toggleWorkbook = (workbookId: string) => {
    setExpandedWorkbooks((prev) => {
      const next = new Set(prev);
      if (next.has(workbookId)) {
        next.delete(workbookId);
      } else {
        next.add(workbookId);
      }
      return next;
    });
  };

  const toggleFolder = (workbookId: string, folderName: string) => {
    const key = `${workbookId}::${folderName}`;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDocumentClick = (workbookId: string, doc: any) => {
    // Don't await - let it load in background to prevent blocking UI
    openDocument({
      workbookId,
      path: doc.path,
      filename: doc.filename,
    }).catch((error) => {
      console.error("Failed to open document:", error);
      notifyError(error instanceof Error ? error.message : "Failed to open document", "Workbooks");
    });
  };

  const handleDocumentContextMenu = (
    e: React.MouseEvent,
    workbookId: string,
    doc: any,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDocumentContextMenu({
      x: e.clientX,
      y: e.clientY,
      workbookId,
      documentPath: getDocRelativePath(doc),
      documentName: doc.filename,
    });
  };

  const handleFolderContextMenu = (
    e: React.MouseEvent,
    workbookId: string,
    folderName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderContextMenu({
      x: e.clientX,
      y: e.clientY,
      workbookId,
      folderName,
    });
  };

  const handleDeleteDocument = (
    workbookId: string,
    documentPath: string,
    documentName: string,
  ) => {
    if (!window.electronAPI?.file) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    setDocumentContextMenu(null);

    setConfirmDialog({
      isOpen: true,
      title: "Delete Document",
      message: `Are you sure you want to delete "${documentName}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        try {
          await window.electronAPI.file.delete(workbookId, documentPath);
          await loadWorkbooks();
          notifySuccess(`Deleted "${documentName}"`, "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to delete document", "Workbooks");
        }
      },
    });
  };

  const handleRenameDocument = (workbookId: string, documentPath: string, documentName: string) => {
    if (!window.electronAPI?.file) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    setDocumentContextMenu(null);
    setInputDialog({
      isOpen: true,
      title: "Rename Document",
      defaultValue: documentName,
      onConfirm: async (newName: string) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        const name = (newName || "").trim();
        if (!name || name === documentName) return;
        try {
          await window.electronAPI.file.rename(workbookId, documentPath, name);
          await loadWorkbooks();
          notifySuccess(`Renamed to "${name}"`, "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to rename document", "Workbooks");
        }
      },
    });
  };

  const handleMoveDocument = (workbookId: string, documentPath: string, documentName: string) => {
    setDocumentContextMenu(null);
    setMoveDocDialog({
      isOpen: true,
      sourceWorkbookId: workbookId,
      sourceRelativePath: documentPath,
      sourceFilename: documentName,
    });
  };

  const handleRenameFolder = (workbookId: string, folderName: string) => {
    if (!window.electronAPI?.workbook?.renameFolder) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }
    setFolderContextMenu(null);
    setInputDialog({
      isOpen: true,
      title: "Rename Folder",
      defaultValue: folderName,
      onConfirm: async (newName: string) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        const name = (newName || "").trim();
        if (!name || name === folderName) return;
        try {
          await window.electronAPI.workbook.renameFolder(workbookId, folderName, name);
          await loadWorkbooks();
          // Preserve expanded state if the folder was open
          setExpandedFolders((prev) => {
            const next = new Set(prev);
            const oldKey = `${workbookId}::${folderName}`;
            const newKey = `${workbookId}::${name}`;
            if (next.has(oldKey)) {
              next.delete(oldKey);
              next.add(newKey);
            }
            return next;
          });
          notifySuccess(`Folder renamed to "${name}"`, "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to rename folder", "Workbooks");
        }
      },
    });
  };

  const handleDeleteFolder = (workbookId: string, folderName: string) => {
    if (!window.electronAPI?.workbook?.deleteFolder) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }
    setFolderContextMenu(null);
    setConfirmDialog({
      isOpen: true,
      title: "Delete Folder",
      message: `Delete folder "${folderName}" and all its contents? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await window.electronAPI.workbook.deleteFolder(workbookId, folderName);
          await loadWorkbooks();
          setExpandedFolders((prev) => {
            const next = new Set(prev);
            next.delete(`${workbookId}::${folderName}`);
            return next;
          });
          notifySuccess(`Folder "${folderName}" deleted`, "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to delete folder", "Workbooks");
        }
      },
    });
  };

  const runWorkbookAction = async (action: WorkbookActionContribution, workbookId: string) => {
    try {
      const result = await action.onClick(workbookId);
      await loadWorkbooks();
      if (action.id === "jupyter.create-notebook" && typeof result === "string") {
        notifySuccess(`Notebook "${result}" created`, "Workbooks");
      }
    } catch (error) {
      console.error(`Failed to run action ${action.id}:`, error);
      const actionLabel = action.title || "action";
      notifyError(
        error instanceof Error ? error.message : `Failed to ${actionLabel.toLowerCase()}`,
        "Workbooks",
      );
    }
  };

  const handleAddFile = async (workbookId: string) => {
    if (!window.electronAPI?.dialog || !window.electronAPI?.file) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    const filePaths = await window.electronAPI.dialog.openFiles();
    if (!filePaths || filePaths.length === 0) return;

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const filePath of filePaths) {
      try {
        await window.electronAPI.file.add(workbookId, filePath);
        successCount++;
      } catch (err) {
        errorCount++;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${filePath}: ${errorMsg}`);
        console.error(`Failed to add file ${filePath}:`, err);
      }
    }

    await loadWorkbooks();

    // Show summary if multiple files
    if (filePaths.length > 1) {
      if (errorCount === 0) {
        notifySuccess(`Added ${successCount} file(s)`, "Workbooks");
      } else {
        notifyInfo(`Added ${successCount} file(s), ${errorCount} failed`, "Workbooks");
        notifyError(errors[0], "Workbooks");
      }
    } else if (errorCount > 0) {
      notifyError(errors[0], "Workbooks");
    } else if (successCount === 1) {
      notifySuccess("File added", "Workbooks");
    }
  };

  const handleCreateMarkdownDoc = (workbookId: string, folderName?: string) => {
    if (!window.electronAPI?.file?.write) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    const folder = (folderName || "").trim();
    const whereLabel = folder ? `/${folder}` : "workbook";
    setInputDialog({
      isOpen: true,
      title: `Create Markdown (${whereLabel})`,
      defaultValue: "new.md",
      onConfirm: async (rawName: string) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        const base = (rawName || "").trim();
        if (!base) return;
        const filename = base.toLowerCase().endsWith(".md") ? base : `${base}.md`;
        const relPath = folder ? `documents/${folder}/${filename}` : `documents/${filename}`;

        try {
          await window.electronAPI.file.write(workbookId, relPath, "");
          await loadWorkbooks();

          // Ensure the destination area is visible for humans immediately.
          setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
          if (folder) {
            const folderKey = `${workbookId}::${folder}`;
            setExpandedFolders((prev) => new Set(prev).add(folderKey));
          }

          // Open the new document tab right away.
          await openDocument({
            workbookId,
            path: relPath,
            filename,
            content: "",
          } as any);

          notifySuccess(`Markdown "${filename}" created`, "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to create markdown", "Workbooks");
        }
      },
    });
  };

  const handleAddFileToFolder = async (workbookId: string, folderName: string) => {
    if (!window.electronAPI?.dialog || !window.electronAPI?.file) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    const filePaths = await window.electronAPI.dialog.openFiles();
    if (!filePaths || filePaths.length === 0) return;

    let moved = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const filePath of filePaths) {
      try {
        await window.electronAPI.file.add(workbookId, filePath);
        const base = String(filePath).split(/[/\\]/).pop();
        if (base) {
          await window.electronAPI.file.moveToFolder(
            workbookId,
            `documents/${base}`,
            workbookId,
            folderName,
          );
        }
        moved++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${filePath}: ${msg}`);
        console.error(`Failed to add/move file ${filePath}:`, err);
      }
    }

    await loadWorkbooks();
    if (failed === 0) notifySuccess(`Added ${moved} file(s) to "${folderName}"`, "Workbooks");
    else {
      notifyInfo(`Added ${moved} file(s) to "${folderName}", ${failed} failed`, "Workbooks");
      if (errors[0]) notifyError(errors[0], "Workbooks");
    }
  };

  const runWorkbookActionInFolder = async (
    action: WorkbookActionContribution,
    workbookId: string,
    folderName: string,
  ) => {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
      let suggested: string | undefined;

      if (action.id === "jupyter.create-notebook") {
        suggested = `${folderName}/notebook-${ts}`;
      } else if (action.id === "spreadsheet.create-sheet") {
        suggested = `${folderName}/spreadsheet-${ts}`;
      }

      const result = await action.onClick(workbookId, suggested);
      await loadWorkbooks();
      if (typeof result === "string") {
        notifySuccess(`Created "${result}"`, "Workbooks");
      } else {
        notifySuccess(`${action.title} created`, "Workbooks");
      }
    } catch (error) {
      console.error(`Failed to run action ${action.id} in folder:`, error);
      const actionLabel = action.title || "action";
      notifyError(
        error instanceof Error ? error.message : `Failed to ${actionLabel.toLowerCase()}`,
        "Workbooks",
      );
    }
  };

  const handleCreateFolder = (workbookId: string) => {
    if (!window.electronAPI?.workbook?.createFolder) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    setInputDialog({
      isOpen: true,
      title: "Create Folder",
      defaultValue: "",
      onConfirm: async (folderName: string) => {
        setInputDialog((prev) => ({ ...prev, isOpen: false }));
        const name = (folderName || "").trim();
        if (!name) return;
        try {
          await window.electronAPI.workbook.createFolder(workbookId, name);
          await loadWorkbooks();
          // Ensure the workbook stays expanded so users can see the new folder immediately.
          setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
          notifySuccess(`Folder "${name}" created`, "Workbooks");
        } catch (err) {
          notifyError(err instanceof Error ? err.message : "Failed to create folder", "Workbooks");
        }
      },
    });
  };

  const handleDropOnWorkbook = async (e: React.DragEvent, workbookId: string) => {
    e.preventDefault();

    if (!window.electronAPI?.file) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    // Internal drag-drop (move folder to another workbook)
    const folderPayload = readFolderDragPayload(e.dataTransfer);
    if (folderPayload) {
      try {
        if (folderPayload.workbookId === workbookId) {
          // no-op
          return;
        }
        await handleMoveFolder(folderPayload.workbookId, folderPayload.folderName, workbookId);
      } finally {
        setDraggingFolder(null);
        setDragOverTarget(null);
      }
      return;
    }

    // Internal drag-drop (move document)
    const docPayload = readDocDragPayload(e.dataTransfer);
    if (docPayload) {
      try {
        await window.electronAPI.file.moveToFolder(
          docPayload.workbookId,
          docPayload.relativePath,
          workbookId,
          undefined,
        );
        await loadWorkbooks();
        setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
        notifySuccess(`Moved "${docPayload.filename}"`, "Workbooks");
      } catch (err) {
        notifyError(err instanceof Error ? err.message : "Failed to move document", "Workbooks");
      } finally {
        setDraggingDoc(null);
        setDragOverTarget(null);
      }
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    let added = 0;
    let failed = 0;

    for (const file of files) {
      try {
        // In Electron, File objects from OS drag-drop have a path property
        const filePath = (file as any).path;
        if (!filePath) {
          console.warn("File path not available for:", file.name);
          continue;
        }
        await window.electronAPI.file.add(workbookId, filePath);
        added++;
      } catch (err) {
        console.error("Failed to add file:", err);
        failed++;
        notifyError(err instanceof Error ? err.message : "Failed to add file", "Workbooks");
      }
    }

    await loadWorkbooks();
    if (added > 0 && failed === 0) notifySuccess(`Added ${added} file(s)`, "Workbooks");
    if (added > 0 && failed > 0) notifyInfo(`Added ${added} file(s), ${failed} failed`, "Workbooks");
    setDragOverTarget(null);
  };

  const handleDragOverWorkbook = (e: React.DragEvent, workbookId: string) => {
    e.preventDefault();
    const folderPayload = draggingFolder || readFolderDragPayload(e.dataTransfer);
    if (folderPayload) {
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget({ kind: "workbook", workbookId });
      return;
    }

    const docPayload = draggingDoc || readDocDragPayload(e.dataTransfer);
    if (docPayload) {
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget({ kind: "workbook", workbookId });
    } else {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDropOnFolder = async (e: React.DragEvent, workbookId: string, folderName: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.electronAPI?.file) {
      notifyError("Electron API not available", "Workbooks");
      return;
    }

    const docPayload = readDocDragPayload(e.dataTransfer);
    if (docPayload) {
      try {
        await window.electronAPI.file.moveToFolder(
          docPayload.workbookId,
          docPayload.relativePath,
          workbookId,
          folderName,
        );
        await loadWorkbooks();
        setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
        setExpandedFolders((prev) => new Set(prev).add(`${workbookId}::${folderName}`));
        notifySuccess(`Moved "${docPayload.filename}" to "${folderName}"`, "Workbooks");
      } catch (err) {
        notifyError(err instanceof Error ? err.message : "Failed to move document", "Workbooks");
      } finally {
        setDraggingDoc(null);
        setDragOverTarget(null);
      }
      return;
    }

    // OS drag-drop: import files and move into folder
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    let moved = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const filePath = (file as any).path;
        if (!filePath) continue;
        await window.electronAPI.file.add(workbookId, filePath);
        const base = String(filePath).split(/[/\\]/).pop();
        if (base) {
          await window.electronAPI.file.moveToFolder(workbookId, `documents/${base}`, workbookId, folderName);
        }
        moved++;
      } catch (err) {
        failed++;
        console.error("Failed to add/move dropped file:", err);
      }
    }

    await loadWorkbooks();
    if (failed === 0) notifySuccess(`Added ${moved} file(s) to "${folderName}"`, "Workbooks");
    else notifyInfo(`Added ${moved} file(s) to "${folderName}", ${failed} failed`, "Workbooks");
    setDragOverTarget(null);
  };

  const handleDragOverFolder = (e: React.DragEvent, workbookId: string, folderName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const docPayload = draggingDoc || readDocDragPayload(e.dataTransfer);
    if (docPayload) {
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget({ kind: "folder", workbookId, folderName });
    } else {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const activeWorkbooks = workbooks.filter((w) => !w.archived);
  const archivedWorkbooks = workbooks.filter((w) => w.archived);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <div className="text-sm text-gray-500">Loading...</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}

        {activeWorkbooks.length === 0 && !loading && (
          <div className="mt-4 text-sm text-gray-500">
            No workbooks yet. Right-click to create one.
          </div>
        )}

        {activeWorkbooks.map((workbook) => (
          <div
            key={workbook.id}
            className={`mb-1 rounded ${dragOverTarget?.kind === "workbook" && dragOverTarget.workbookId === workbook.id ? "bg-blue-50 ring-1 ring-blue-300" : ""}`}
            onDrop={(e) => handleDropOnWorkbook(e, workbook.id)}
            onDragOver={(e) => handleDragOverWorkbook(e, workbook.id)}
            data-testid={`workbooks-item-${workbook.id}`}
          >
            <div
              className="group flex cursor-pointer items-center justify-between rounded p-1 hover:bg-gray-100"
              onContextMenu={(e) => handleContextMenu(e, workbook.id)}
            >
              <span
                className="flex items-center gap-1 text-sm flex-1"
                onClick={() => toggleWorkbook(workbook.id)}
                data-testid={`workbooks-toggle-${workbook.id}`}
              >
                {expandedWorkbooks.has(workbook.id) ? "▼" : "▶"}{" "}
                {workbook.name}
              </span>
              {workbook.archived ? (
                <span className="text-xs text-gray-400">(archived)</span>
              ) : (
                <div className={`flex items-center gap-0.5 ${forceVisibleControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateMarkdownDoc(workbook.id);
                    }}
                    className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    title="Create Markdown"
                    data-testid={`workbooks-create-markdown-${workbook.id}`}
                  >
                    <AddIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddFile(workbook.id);
                    }}
                    className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                    title="Import Files"
                      data-testid={`workbooks-create-document-${workbook.id}`}
                  >
                    <FileIcon className="h-4 w-4" />
                  </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateFolder(workbook.id);
                      }}
                      className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                      title="Create Folder"
                      data-testid={`workbooks-create-folder-${workbook.id}`}
                    >
                      <FolderIcon className="h-4 w-4" />
                    </button>
                  {workbookActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        runWorkbookAction(action, workbook.id);
                      }}
                      className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                      title={action.title}
                        data-testid={`workbooks-action-${action.id}-${workbook.id}`}
                    >
                      {action.icon ? <action.icon className="h-4 w-4" /> : <span className="text-xs">{action.title}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {expandedWorkbooks.has(workbook.id) && (
              <div className="ml-4 mt-1">
                {(() => {
                  const docs = (workbook.documents || []).filter((d: any) => !d.archived);
                  const folderNames: string[] = Array.isArray(workbook.folders) ? workbook.folders : [];
                  const topLevelDocs = docs.filter((d: any) => {
                    const folder = d.folder || (typeof d.path === "string" && d.path.replace(/\\/g, "/").split("/")[1]);
                    return !folder || !folderNames.includes(folder);
                  });

                  const totalDocs = docs.length;
                  const hasAny = totalDocs > 0 || folderNames.length > 0;
                  if (!hasAny) return <div className="text-xs text-gray-400">No documents</div>;

                  return (
                    <div className="flex flex-col gap-0.5">
                      {folderNames.map((folderName) => {
                        const folderKey = `${workbook.id}::${folderName}`;
                        const inFolder = docs.filter((d: any) => {
                          if (d.folder === folderName) return true;
                          const p = typeof d.path === "string" ? d.path.replace(/\\/g, "/") : "";
                          return p.startsWith(`documents/${folderName}/`);
                        });

                        return (
                          <div key={folderName}>
                            <div
                              className={`group flex cursor-pointer items-center justify-between rounded px-1 py-0.5 text-xs text-gray-700 hover:bg-gray-100 ${
                                dragOverTarget?.kind === "folder" &&
                                dragOverTarget.workbookId === workbook.id &&
                                dragOverTarget.folderName === folderName
                                  ? "bg-blue-50 ring-1 ring-blue-300"
                                  : ""
                              }`}
                              onClick={() => toggleFolder(workbook.id, folderName)}
                              onContextMenu={(e) => handleFolderContextMenu(e, workbook.id, folderName)}
                              onDrop={(e) => handleDropOnFolder(e, workbook.id, folderName)}
                              onDragOver={(e) => handleDragOverFolder(e, workbook.id, folderName)}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                const payload: DragFolderPayload = {
                                  kind: "folder",
                                  workbookId: workbook.id,
                                  folderName,
                                };
                                setDraggingFolder(payload);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData(FOLDER_DRAG_MIME, JSON.stringify(payload));
                              }}
                              onDragEnd={() => {
                                setDraggingFolder(null);
                                setDragOverTarget(null);
                              }}
                              data-testid={`workbooks-folder-${workbook.id}-${encodeURIComponent(folderName)}`}
                              data-folder-name={folderName}
                            >
                              <span className="flex items-center gap-1">
                                {expandedFolders.has(folderKey) ? "▼" : "▶"} 📁 {folderName}
                              </span>
                              <div className={`flex items-center gap-0.5 ${forceVisibleControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateMarkdownDoc(workbook.id, folderName);
                                  }}
                                  className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                  title="Create Markdown in folder"
                                  data-testid={`workbooks-folder-create-markdown-${workbook.id}-${encodeURIComponent(folderName)}`}
                                >
                                  <AddIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddFileToFolder(workbook.id, folderName);
                                  }}
                                  className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                  title="Add files to folder"
                                  data-testid={`workbooks-folder-addfiles-${workbook.id}-${encodeURIComponent(folderName)}`}
                                >
                                  <FileIcon className="h-4 w-4" />
                                </button>
                                {workbookActions
                                  .filter((a) => a.id === "jupyter.create-notebook" || a.id === "spreadsheet.create-sheet")
                                  .map((action) => (
                                    <button
                                      key={`${folderName}-${action.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        runWorkbookActionInFolder(action, workbook.id, folderName);
                                      }}
                                      className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                      title={action.title}
                                      data-testid={`workbooks-folder-action-${action.id}-${workbook.id}-${encodeURIComponent(folderName)}`}
                                    >
                                      {action.icon ? <action.icon className="h-4 w-4" /> : <span className="text-xs">{action.title}</span>}
                                    </button>
                                  ))}
                              </div>
                            </div>
                            {expandedFolders.has(folderKey) && (
                              <div className="ml-3 mt-0.5">
                                {inFolder.length === 0 ? (
                                  <div className="text-[11px] text-gray-400">Empty</div>
                                ) : (
                                  inFolder.map((doc: any, idx: number) => (
                                    <div
                                      key={`${doc.docId || doc.path || idx}`}
                                      className="group flex cursor-pointer items-center justify-between rounded px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                                      onClick={() => handleDocumentClick(workbook.id, doc)}
                                      onContextMenu={(e) => handleDocumentContextMenu(e, workbook.id, doc)}
                                      draggable
                                      onDragStart={(e) => {
                                        e.stopPropagation();
                                        const relativePath = getDocRelativePath(doc);
                                        const payload: DragDocPayload = {
                                          kind: "doc",
                                          workbookId: workbook.id,
                                          relativePath,
                                          filename: doc.filename,
                                        };
                                        setDraggingDoc(payload);
                                        e.dataTransfer.effectAllowed = "move";
                                        e.dataTransfer.setData(DOC_DRAG_MIME, JSON.stringify(payload));
                                      }}
                                      onDragEnd={() => {
                                        setDraggingDoc(null);
                                        setDragOverTarget(null);
                                      }}
                                      data-testid={`workbooks-doc-${workbook.id}-${encodeURIComponent(doc.path || doc.filename)}`}
                                    >
                                      <span className="truncate">📄 {doc.filename}</span>
                                      <div className={`flex items-center gap-0.5 ${forceVisibleControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRenameDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                                          }}
                                          className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                          title="Rename"
                                          aria-label="Rename"
                                          data-testid={`workbooks-doc-rename-${workbook.id}-${encodeURIComponent(getDocRelativePath(doc))}`}
                                        >
                                          <span className="text-[11px]">✎</span>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                                          }}
                                          className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                          title="Move"
                                          aria-label="Move"
                                          data-testid={`workbooks-doc-move-${workbook.id}-${encodeURIComponent(getDocRelativePath(doc))}`}
                                        >
                                          <span className="text-[11px]">⇄</span>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                                          }}
                                          className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-red-700"
                                          title="Delete"
                                          aria-label="Delete"
                                          data-testid={`workbooks-doc-delete-${workbook.id}-${encodeURIComponent(getDocRelativePath(doc))}`}
                                        >
                                          <DeleteIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {topLevelDocs.map((doc: any, idx: number) => (
                        <div
                          key={`${doc.docId || doc.path || idx}`}
                          className="group flex cursor-pointer items-center justify-between rounded px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                          onClick={() => handleDocumentClick(workbook.id, doc)}
                          onContextMenu={(e) => handleDocumentContextMenu(e, workbook.id, doc)}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            const relativePath = getDocRelativePath(doc);
                            const payload: DragDocPayload = {
                              kind: "doc",
                              workbookId: workbook.id,
                              relativePath,
                              filename: doc.filename,
                            };
                            setDraggingDoc(payload);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData(DOC_DRAG_MIME, JSON.stringify(payload));
                          }}
                          onDragEnd={() => {
                            setDraggingDoc(null);
                            setDragOverTarget(null);
                          }}
                          data-testid={`workbooks-doc-${workbook.id}-${encodeURIComponent(doc.path || doc.filename)}`}
                        >
                          <span className="truncate">📄 {doc.filename}</span>
                          <div className={`flex items-center gap-0.5 ${forceVisibleControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                              }}
                              className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                              title="Rename"
                              aria-label="Rename"
                              data-testid={`workbooks-doc-rename-${workbook.id}-${encodeURIComponent(getDocRelativePath(doc))}`}
                            >
                              <span className="text-[11px]">✎</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                              }}
                              className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                              title="Move"
                              aria-label="Move"
                              data-testid={`workbooks-doc-move-${workbook.id}-${encodeURIComponent(getDocRelativePath(doc))}`}
                            >
                              <span className="text-[11px]">⇄</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                              }}
                              className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-red-700"
                              title="Delete"
                              aria-label="Delete"
                              data-testid={`workbooks-doc-delete-${workbook.id}-${encodeURIComponent(getDocRelativePath(doc))}`}
                            >
                              <DeleteIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}

        {archivedWorkbooks.length > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="mb-2 text-xs font-semibold text-gray-500">
              Archived
            </div>
            {archivedWorkbooks.map((workbook) => (
              <div key={workbook.id} className="py-1 text-xs text-gray-400">
                {workbook.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-20 rounded border border-gray-200 bg-white py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100"
              onClick={() => handleRenameWorkbook(contextMenu.workbookId)}
            >
              Rename
            </button>
            <button
              className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100"
              onClick={() => handleArchiveWorkbook(contextMenu.workbookId)}
            >
              Archive
            </button>
            <button
              className="block w-full px-3 py-1 text-left text-sm text-red-600 hover:bg-gray-100"
              onClick={() => handleDeleteWorkbook(contextMenu.workbookId)}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {documentContextMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setDocumentContextMenu(null)}
          />
          <div
            className="fixed z-20 rounded border border-gray-200 bg-white py-1 shadow-lg"
            style={{
              left: documentContextMenu.x,
              top: documentContextMenu.y,
            }}
          >
            <button
              className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100"
              onClick={() =>
                handleRenameDocument(
                  documentContextMenu.workbookId,
                  documentContextMenu.documentPath,
                  documentContextMenu.documentName,
                )
              }
              data-testid="workbooks-doc-context-rename"
            >
              Rename
            </button>
            <button
              className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100"
              onClick={() =>
                handleMoveDocument(
                  documentContextMenu.workbookId,
                  documentContextMenu.documentPath,
                  documentContextMenu.documentName,
                )
              }
              data-testid="workbooks-doc-context-move"
            >
              Move
            </button>
            <button
              className="block w-full px-3 py-1 text-left text-sm text-red-600 hover:bg-gray-100"
              onClick={() =>
                handleDeleteDocument(
                  documentContextMenu.workbookId,
                  documentContextMenu.documentPath,
                  documentContextMenu.documentName,
                )
              }
              data-testid="workbooks-doc-context-delete"
            >
              Delete
            </button>
          </div>
        </>
      )}

      {folderContextMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setFolderContextMenu(null)} />
          <div
            className="fixed z-20 rounded border border-gray-200 bg-white py-1 shadow-lg"
            style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
          >
            <button
              className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100"
              onClick={() => {
                const fromWb = folderContextMenu.workbookId;
                const fromFolder = folderContextMenu.folderName;
                setFolderContextMenu(null);
                setMoveFolderDialog({ isOpen: true, sourceWorkbookId: fromWb, sourceFolderName: fromFolder });
              }}
              data-testid="workbooks-folder-context-move"
            >
              Move…
            </button>
            <button
              className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100"
              onClick={() => handleRenameFolder(folderContextMenu.workbookId, folderContextMenu.folderName)}
              data-testid="workbooks-folder-context-rename"
            >
              Rename
            </button>
            <button
              className="block w-full px-3 py-1 text-left text-sm text-red-600 hover:bg-gray-100"
              onClick={() => handleDeleteFolder(folderContextMenu.workbookId, folderContextMenu.folderName)}
              data-testid="workbooks-folder-context-delete"
            >
              Delete
            </button>
          </div>
        </>
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

      <MoveFolderDialog
        isOpen={moveFolderDialog.isOpen}
        workbooks={workbooks}
        sourceWorkbookId={moveFolderDialog.sourceWorkbookId}
        sourceFolderName={moveFolderDialog.sourceFolderName}
        onCancel={() => setMoveFolderDialog({ isOpen: false, sourceWorkbookId: "", sourceFolderName: "" })}
        onConfirm={async (targetWorkbookId, targetFolderName) => {
          setMoveFolderDialog({ isOpen: false, sourceWorkbookId: "", sourceFolderName: "" });
          await performMoveFolder(
            moveFolderDialog.sourceWorkbookId,
            moveFolderDialog.sourceFolderName,
            targetWorkbookId,
            targetFolderName,
          );
        }}
      />

      <MoveDocumentDialog
        isOpen={moveDocDialog.isOpen}
        workbooks={workbooks}
        sourceWorkbookId={moveDocDialog.sourceWorkbookId}
        sourceRelativePath={moveDocDialog.sourceRelativePath}
        sourceFilename={moveDocDialog.sourceFilename}
        onCancel={() =>
          setMoveDocDialog({ isOpen: false, sourceWorkbookId: "", sourceRelativePath: "", sourceFilename: "" })
        }
        onConfirm={async ({ targetWorkbookId, targetFolder, targetFilename }) => {
          const sourceWb = moveDocDialog.sourceWorkbookId;
          const sourcePath = moveDocDialog.sourceRelativePath;
          const sourceName = moveDocDialog.sourceFilename;
          setMoveDocDialog({ isOpen: false, sourceWorkbookId: "", sourceRelativePath: "", sourceFilename: "" });

          if (!window.electronAPI?.file) {
            notifyError("Electron API not available", "Workbooks");
            return;
          }

          try {
            // Move (possibly cross-workbook)
            await window.electronAPI.file.moveToFolder(sourceWb, sourcePath, targetWorkbookId, targetFolder);

            // Optional rename after move (same folder in destination)
            if (targetFilename && targetFilename !== sourceName) {
              const folder = (targetFolder || "").trim();
              const movedPath = folder
                ? `documents/${folder}/${sourceName}`
                : `documents/${sourceName}`;
              await window.electronAPI.file.rename(targetWorkbookId, movedPath, targetFilename);
            }

            await loadWorkbooks();
            setExpandedWorkbooks((prev) => new Set(prev).add(targetWorkbookId));
            if (targetFolder) {
              setExpandedFolders((prev) => new Set(prev).add(`${targetWorkbookId}::${targetFolder}`));
            }
            notifySuccess(`Moved "${sourceName}"`, "Workbooks");
          } catch (err) {
            notifyError(err instanceof Error ? err.message : "Failed to move document", "Workbooks");
          }
        }}
      />
    </div>
  );
}
