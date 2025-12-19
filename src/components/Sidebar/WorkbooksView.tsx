import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { ConfirmDialog } from "../ConfirmDialog";
import { InputDialog } from "../InputDialog";
import { AddIcon, RefreshIcon, CollapseAllIcon, FileIcon, FolderIcon, DeleteIcon, PencilIcon, MoveIcon } from "../Icons";
import { extensionRegistry } from "../../services/extensionRegistry";
import { WorkbookActionContribution } from "../../types";
import { notifyError, notifyInfo, notifySuccess } from "../../utils/notify";
import { getFileTypeIcon } from "../../utils/fileTypeIcon";
import { MoveFolderDialog } from "../MoveFolderDialog";
import { MoveDocumentDialog } from "../MoveDocumentDialog";
import { ConflictResolutionDialog, type CollisionResolution } from "../ConflictResolutionDialog";
import { testIds } from "../../testing/testIds";
import { setAutomationState } from "../../testing/automationState";

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
  const collisionResolverRef = useRef<((res: CollisionResolution) => void) | null>(null);
  const [collisionDialog, setCollisionDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    defaultName: string;
    allowApplyToAll: boolean;
  }>({ isOpen: false, title: "", message: "", defaultName: "", allowApplyToAll: false });
  const [expandedWorkbooks, setExpandedWorkbooks] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const prevExpandedWorkbooksRef = useRef<Set<string> | null>(null);
  const prevExpandedFoldersRef = useRef<Set<string> | null>(null);
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

  const isCollisionError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err || "");
    return msg.includes("Target file already exists:") || msg.includes("File already exists:");
  };

  const suggestRename = (filename: string) => {
    const base = String(filename || "").trim();
    if (!base) return "new-name";
    const lastDot = base.lastIndexOf(".");
    if (lastDot <= 0) return `${base} (1)`;
    const name = base.slice(0, lastDot);
    const ext = base.slice(lastDot);
    return `${name} (1)${ext}`;
  };

  const promptCollision = useCallback(
    async (params: { title: string; message: string; defaultName: string; allowApplyToAll?: boolean }) => {
      return await new Promise<CollisionResolution>((resolve) => {
        collisionResolverRef.current = resolve;
        setCollisionDialog({
          isOpen: true,
          title: params.title,
          message: params.message,
          defaultName: params.defaultName,
          allowApplyToAll: !!params.allowApplyToAll,
        });
      });
    },
    [],
  );

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

        // Expose deterministic workbooks snapshot for automation:
        // allows mapping name -> id -> doc.path without fuzzy selectors.
        try {
          const cleaned = normalized.map((w: any) => {
            const id = String(w?.id || "");
            const name = String(w?.name || id);
            const folders: string[] = Array.isArray(w?.folders) ? w.folders.map((f: any) => String(f)) : [];
            const docsRaw: any[] = Array.isArray(w?.documents) ? w.documents : [];
            const documents = docsRaw
              .map((d: any) => ({
                filename: String(d?.filename || ""),
                path: String(d?.path || ""),
                archived: !!d?.archived,
                folder: typeof d?.folder === "string" ? d.folder : undefined,
                docId: typeof d?.docId === "string" ? d.docId : undefined,
              }))
              .filter((d) => d.filename && d.path);

            // Deterministic ordering
            documents.sort((a, b) => a.path.localeCompare(b.path) || a.filename.localeCompare(b.filename));
            folders.sort((a, b) => a.localeCompare(b));

            return { id, name, archived: !!w?.archived, folders, documents };
          });
          cleaned.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
          setAutomationState({ workbooks: { workbooks: cleaned, updatedAt: Date.now() } });
        } catch {
          // ignore
        }
      } else {
        setWorkbooks([]);
        try {
          setAutomationState({ workbooks: { workbooks: [], updatedAt: Date.now() } });
        } catch {
          // ignore
        }
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
        let policy: null | { action: "skip" | "overwrite" | "autoRename" } = null;
        for (const doc of inFolder) {
          try {
            const rel = getDocRelativePath(doc);
            if (!rel) continue;
            const baseName = String(doc?.filename || "").trim() || String(rel).split("/").pop() || "file";

            const attempt = async (opts?: { overwrite?: boolean; destFilename?: string }) => {
              await window.electronAPI.file.moveToFolder(
                sourceWorkbookId,
                rel,
                targetWorkbookId,
                toFolder,
                opts,
              );
            };

            try {
              await attempt();
              updateOpenDocumentLocation({
                sourceWorkbookId,
                sourcePath: rel,
                targetWorkbookId,
                targetPath: `documents/${toFolder}/${baseName}`,
                targetFilename: baseName,
              });
              moved++;
            } catch (err) {
              if (!isCollisionError(err)) throw err;

              // Decide resolution (ask once if user checks apply-to-all)
              let resolution: CollisionResolution;
              if (policy?.action === "skip") {
                resolution = { action: "skip", applyToAll: true };
              } else if (policy?.action === "overwrite") {
                resolution = { action: "overwrite", applyToAll: true };
              } else if (policy?.action === "autoRename") {
                resolution = { action: "rename", newName: suggestRename(baseName), applyToAll: true };
              } else {
                resolution = await promptCollision({
                  title: "File already exists",
                  message: `A file named "${baseName}" already exists in the destination folder "${toFolder}".`,
                  defaultName: suggestRename(baseName),
                  allowApplyToAll: true,
                });

                if (resolution.applyToAll) {
                  if (resolution.action === "skip") policy = { action: "skip" };
                  else if (resolution.action === "overwrite") policy = { action: "overwrite" };
                  else policy = { action: "autoRename" };
                }
              }

              if (resolution.action === "skip") {
                failed++;
                continue;
              }

              if (resolution.action === "overwrite") {
                await attempt({ overwrite: true });
                updateOpenDocumentLocation({
                  sourceWorkbookId,
                  sourcePath: rel,
                  targetWorkbookId,
                  targetPath: `documents/${toFolder}/${baseName}`,
                  targetFilename: baseName,
                });
                moved++;
                continue;
              }

              // Rename: try chosen name; if it still collides, auto-increment.
              const desired = (resolution.newName || "").trim() || suggestRename(baseName);
              const lastDot = desired.lastIndexOf(".");
              const nameOnly = lastDot > 0 ? desired.slice(0, lastDot) : desired;
              const ext = lastDot > 0 ? desired.slice(lastDot) : "";

              let n = 0;
              while (n < 50) {
                const candidate = n === 0 ? desired : `${nameOnly} (${n + 1})${ext}`;
                try {
                  await attempt({ destFilename: candidate });
                  updateOpenDocumentLocation({
                    sourceWorkbookId,
                    sourcePath: rel,
                    targetWorkbookId,
                    targetPath: `documents/${toFolder}/${candidate}`,
                    targetFilename: candidate,
                  });
                  moved++;
                  break;
                } catch (e2) {
                  if (!isCollisionError(e2)) throw e2;
                  n++;
                }
              }
              if (n >= 50) {
                failed++;
              }
            }
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
        const targetName = String(targetWb?.name || targetWorkbookId);
        setInputDialog({
          isOpen: true,
          title: `Folder "${fromFolder}" already exists in "${targetName}" — choose a new name`,
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

  // Refresh workbooks when native Demos menu loads data (or other out-of-band updates occur).
  useEffect(() => {
    const handler = () => {
      loadWorkbooks();
    };
    window.addEventListener("workbooks:changed", handler as any);
    window.addEventListener("demos:changed", handler as any);
    return () => {
      window.removeEventListener("workbooks:changed", handler as any);
      window.removeEventListener("demos:changed", handler as any);
    };
  }, [loadWorkbooks]);

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
            data-testid={testIds.workbooks.header.create}
          >
            <AddIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleRefreshWorkbooks}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Refresh Workbooks"
            data-testid={testIds.workbooks.header.refresh}
          >
            <RefreshIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleCollapseAll}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Collapse All"
            data-testid={testIds.workbooks.header.collapseAll}
          >
            <CollapseAllIcon className="h-4 w-4" />
          </button>
        </div>
      );
    }
  }, [onActionButton, handleCreateWorkbook, handleRefreshWorkbooks, handleCollapseAll]);

  // Allow App header search icon to expand Workbooks then focus the search input.
  useEffect(() => {
    const focus = () => {
      try {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } catch {
        // ignore
      }
    };
    const onFocusSearch = () => focus();
    window.addEventListener("workbooks:focusSearch", onFocusSearch as any);
    // If App set a global flag before WorkbooksView mounted, honor it once.
    if ((window as any).__insightlmFocusWorkbooksSearch === true) {
      (window as any).__insightlmFocusWorkbooksSearch = false;
      setTimeout(() => focus(), 0);
    }
    return () => window.removeEventListener("workbooks:focusSearch", onFocusSearch as any);
  }, []);

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

  const { openDocument, updateOpenDocumentLocation, updateOpenDocumentsPathPrefix } = useDocumentStore();

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
          const parent = String(documentPath || "").replace(/\\/g, "/").split("/").slice(0, -1).join("/");
          const newPath = parent ? `${parent}/${name}` : `documents/${name}`;
          updateOpenDocumentLocation({
            sourceWorkbookId: workbookId,
            sourcePath: documentPath,
            targetWorkbookId: workbookId,
            targetPath: newPath,
            targetFilename: name,
          });
          await loadWorkbooks();
          notifySuccess(`Renamed to "${name}"`, "Workbooks");
        } catch (err) {
          if (isCollisionError(err)) {
            const resolution = await promptCollision({
              title: "Name already exists",
              message: `A file named "${name}" already exists in this folder.`,
              defaultName: suggestRename(name),
            });

            if (resolution.action === "skip") return;

            if (resolution.action === "rename") {
              const tryName = (resolution.newName || "").trim();
              if (!tryName) return;
              try {
                await window.electronAPI.file.rename(workbookId, documentPath, tryName);
                const parent = String(documentPath || "").replace(/\\/g, "/").split("/").slice(0, -1).join("/");
                const newPath = parent ? `${parent}/${tryName}` : `documents/${tryName}`;
                updateOpenDocumentLocation({
                  sourceWorkbookId: workbookId,
                  sourcePath: documentPath,
                  targetWorkbookId: workbookId,
                  targetPath: newPath,
                  targetFilename: tryName,
                });
                await loadWorkbooks();
                notifySuccess(`Renamed to "${tryName}"`, "Workbooks");
              } catch (e2) {
                notifyError(e2 instanceof Error ? e2.message : "Failed to rename document", "Workbooks");
              }
              return;
            }

            if (resolution.action === "overwrite") {
              try {
                const parent = String(documentPath || "").replace(/\\/g, "/").split("/").slice(0, -1).join("/");
                const destRel = parent ? `${parent}/${name}` : `documents/${name}`;
                await window.electronAPI.file.delete(workbookId, destRel);
                await window.electronAPI.file.rename(workbookId, documentPath, name);
                updateOpenDocumentLocation({
                  sourceWorkbookId: workbookId,
                  sourcePath: documentPath,
                  targetWorkbookId: workbookId,
                  targetPath: destRel,
                  targetFilename: name,
                });
                await loadWorkbooks();
                notifySuccess(`Renamed to "${name}"`, "Workbooks");
              } catch (e3) {
                notifyError(e3 instanceof Error ? e3.message : "Failed to rename document", "Workbooks");
              }
              return;
            }
          }

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
          updateOpenDocumentsPathPrefix({
            workbookId,
            fromPrefix: `documents/${folderName}/`,
            toPrefix: `documents/${name}/`,
          });
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

    const wb = workbooks.find((w: any) => w.id === workbookId);
    const docs = Array.isArray((wb as any)?.documents) ? (wb as any).documents : [];
    const folder = String(folderName || "").trim();
    const countInFolder = folder
      ? docs.filter((d: any) => {
          if (String(d?.folder || "").trim() === folder) return true;
          const p = typeof d?.path === "string" ? d.path.replace(/\\/g, "/") : "";
          return p.startsWith(`documents/${folder}/`);
        }).length
      : 0;
    const countLabel = countInFolder === 1 ? "1 item" : `${countInFolder} items`;

    setConfirmDialog({
      isOpen: true,
      title: "Delete Folder",
      message:
        countInFolder > 0
          ? `Delete folder "${folderName}" and its contents (${countLabel})? This cannot be undone.`
          : `Delete empty folder "${folderName}"? This cannot be undone.`,
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
        const base = String(filePath).split(/[/\\]/).pop() || "";
        const rel = `documents/${base}`;
        const wb = workbooks.find((w: any) => w.id === workbookId);
        const exists = !!wb?.documents?.some((d: any) => String(d?.path || "").replace(/\\/g, "/") === rel);

        if (exists) {
          const resolution = await promptCollision({
            title: "File already exists",
            message: `A file named "${base}" already exists in this workbook.`,
            defaultName: suggestRename(base),
            allowApplyToAll: filePaths.length > 1,
          });

          if (resolution.action === "skip") {
            continue;
          }

          if (resolution.action === "rename") {
            const newName = (resolution.newName || "").trim();
            if (!newName) continue;
            await window.electronAPI.file.add(workbookId, filePath, newName);
            successCount++;
            continue;
          }

          // overwrite
          await window.electronAPI.file.add(workbookId, filePath);
          successCount++;
          continue;
        }

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
        const base = String(filePath).split(/[/\\]/).pop() || "";
        if (!base) continue;

        // Import via a temp filename to avoid clobbering root docs.
        const tempName = `__import-${Date.now()}-${Math.random().toString(36).slice(2)}-${base}`;
        await window.electronAPI.file.add(workbookId, filePath, tempName);

        const attemptMove = async (opts?: { overwrite?: boolean; destFilename?: string }) => {
          await window.electronAPI.file.moveToFolder(
            workbookId,
            `documents/${tempName}`,
            workbookId,
            folderName,
            opts,
          );
        };

        try {
          await attemptMove({ destFilename: base });
          moved++;
        } catch (err) {
          if (isCollisionError(err)) {
            const resolution = await promptCollision({
              title: "File already exists in folder",
              message: `A file named "${base}" already exists in "${folderName}".`,
              defaultName: suggestRename(base),
              allowApplyToAll: filePaths.length > 1,
            });
            if (resolution.action === "skip") {
              // Cleanup temp
              await window.electronAPI.file.delete(workbookId, `documents/${tempName}`);
              continue;
            }
            if (resolution.action === "overwrite") {
              await attemptMove({ overwrite: true, destFilename: base });
              moved++;
            } else {
              const newName = (resolution.newName || "").trim();
              if (!newName) {
                await window.electronAPI.file.delete(workbookId, `documents/${tempName}`);
                continue;
              }
              await attemptMove({ destFilename: newName });
              moved++;
            }
          } else {
            throw err;
          }
        }
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
        const attempt = async (opts?: { overwrite?: boolean; destFilename?: string }) => {
          await window.electronAPI.file.moveToFolder(
            docPayload.workbookId,
            docPayload.relativePath,
            workbookId,
            undefined,
            opts,
          );
        };
        try {
          await attempt();
          updateOpenDocumentLocation({
            sourceWorkbookId: docPayload.workbookId,
            sourcePath: docPayload.relativePath,
            targetWorkbookId: workbookId,
            targetPath: `documents/${docPayload.filename}`,
            targetFilename: docPayload.filename,
          });
          await loadWorkbooks();
          setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
          notifySuccess(`Moved "${docPayload.filename}"`, "Workbooks");
        } catch (err) {
          if (!isCollisionError(err)) throw err;
          const resolution = await promptCollision({
            title: "File already exists",
            message: `A file named "${docPayload.filename}" already exists in the destination workbook.`,
            defaultName: suggestRename(docPayload.filename),
          });
          if (resolution.action === "skip") return;
          if (resolution.action === "overwrite") {
            await attempt({ overwrite: true });
            updateOpenDocumentLocation({
              sourceWorkbookId: docPayload.workbookId,
              sourcePath: docPayload.relativePath,
              targetWorkbookId: workbookId,
              targetPath: `documents/${docPayload.filename}`,
              targetFilename: docPayload.filename,
            });
            await loadWorkbooks();
            setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
            notifySuccess(`Moved "${docPayload.filename}"`, "Workbooks");
            return;
          }
          // rename
          const newName = (resolution.newName || "").trim();
          if (!newName) return;
          await attempt({ destFilename: newName });
          updateOpenDocumentLocation({
            sourceWorkbookId: docPayload.workbookId,
            sourcePath: docPayload.relativePath,
            targetWorkbookId: workbookId,
            targetPath: `documents/${newName}`,
            targetFilename: newName,
          });
          await loadWorkbooks();
          setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
          notifySuccess(`Moved "${docPayload.filename}" as "${newName}"`, "Workbooks");
        }
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

        const base = String(filePath).split(/[/\\]/).pop() || file.name || "";
        const rel = `documents/${base}`;
        const wb = workbooks.find((w: any) => w.id === workbookId);
        const exists = !!wb?.documents?.some((d: any) => String(d?.path || "").replace(/\\/g, "/") === rel);

        if (exists) {
          const resolution = await promptCollision({
            title: "File already exists",
            message: `A file named "${base}" already exists in this workbook.`,
            defaultName: suggestRename(base),
            allowApplyToAll: files.length > 1,
          });

          if (resolution.action === "skip") continue;
          if (resolution.action === "rename") {
            const newName = (resolution.newName || "").trim();
            if (!newName) continue;
            await window.electronAPI.file.add(workbookId, filePath, newName);
            added++;
            continue;
          }
          // overwrite
          await window.electronAPI.file.add(workbookId, filePath);
          added++;
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
        const attempt = async (opts?: { overwrite?: boolean; destFilename?: string }) => {
          await window.electronAPI.file.moveToFolder(
            docPayload.workbookId,
            docPayload.relativePath,
            workbookId,
            folderName,
            opts,
          );
        };
        try {
          await attempt();
          updateOpenDocumentLocation({
            sourceWorkbookId: docPayload.workbookId,
            sourcePath: docPayload.relativePath,
            targetWorkbookId: workbookId,
            targetPath: `documents/${folderName}/${docPayload.filename}`,
            targetFilename: docPayload.filename,
          });
          await loadWorkbooks();
          setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
          setExpandedFolders((prev) => new Set(prev).add(`${workbookId}::${folderName}`));
          notifySuccess(`Moved "${docPayload.filename}" to "${folderName}"`, "Workbooks");
        } catch (err) {
          if (!isCollisionError(err)) throw err;
          const resolution = await promptCollision({
            title: "File already exists",
            message: `A file named "${docPayload.filename}" already exists in folder "${folderName}".`,
            defaultName: suggestRename(docPayload.filename),
          });
          if (resolution.action === "skip") return;
          if (resolution.action === "overwrite") {
            await attempt({ overwrite: true });
            updateOpenDocumentLocation({
              sourceWorkbookId: docPayload.workbookId,
              sourcePath: docPayload.relativePath,
              targetWorkbookId: workbookId,
              targetPath: `documents/${folderName}/${docPayload.filename}`,
              targetFilename: docPayload.filename,
            });
            await loadWorkbooks();
            setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
            setExpandedFolders((prev) => new Set(prev).add(`${workbookId}::${folderName}`));
            notifySuccess(`Moved "${docPayload.filename}" to "${folderName}"`, "Workbooks");
            return;
          }
          const newName = (resolution.newName || "").trim();
          if (!newName) return;
          await attempt({ destFilename: newName });
          updateOpenDocumentLocation({
            sourceWorkbookId: docPayload.workbookId,
            sourcePath: docPayload.relativePath,
            targetWorkbookId: workbookId,
            targetPath: `documents/${folderName}/${newName}`,
            targetFilename: newName,
          });
          await loadWorkbooks();
          setExpandedWorkbooks((prev) => new Set(prev).add(workbookId));
          setExpandedFolders((prev) => new Set(prev).add(`${workbookId}::${folderName}`));
          notifySuccess(`Moved "${docPayload.filename}" as "${newName}"`, "Workbooks");
        }
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
        const base = String(filePath).split(/[/\\]/).pop() || file.name || "";
        if (!base) continue;

        const tempName = `__import-${Date.now()}-${Math.random().toString(36).slice(2)}-${base}`;
        await window.electronAPI.file.add(workbookId, filePath, tempName);

        const attemptMove = async (opts?: { overwrite?: boolean; destFilename?: string }) => {
          await window.electronAPI.file.moveToFolder(
            workbookId,
            `documents/${tempName}`,
            workbookId,
            folderName,
            opts,
          );
        };

        try {
          await attemptMove({ destFilename: base });
          moved++;
        } catch (err) {
          if (isCollisionError(err)) {
            const resolution = await promptCollision({
              title: "File already exists in folder",
              message: `A file named "${base}" already exists in "${folderName}".`,
              defaultName: suggestRename(base),
              allowApplyToAll: files.length > 1,
            });
            if (resolution.action === "skip") {
              await window.electronAPI.file.delete(workbookId, `documents/${tempName}`);
              continue;
            }
            if (resolution.action === "overwrite") {
              await attemptMove({ overwrite: true, destFilename: base });
              moved++;
            } else {
              const newName = (resolution.newName || "").trim();
              if (!newName) {
                await window.electronAPI.file.delete(workbookId, `documents/${tempName}`);
                continue;
              }
              await attemptMove({ destFilename: newName });
              moved++;
            }
          } else {
            throw err;
          }
        }
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

  const q = searchQuery.trim().toLowerCase();
  const matches = useCallback(
    (s: any) => String(s || "").toLowerCase().includes(q),
    [q],
  );

  const getDocFolderName = useCallback((doc: any, workbook: any): string => {
    const folderNames: string[] = Array.isArray(workbook?.folders) ? workbook.folders : [];
    const explicit = String(doc?.folder || "").trim();
    if (explicit) return explicit;
    const p = typeof doc?.path === "string" ? doc.path.replace(/\\/g, "/") : "";
    const parts = p.split("/");
    const candidate = parts.length >= 3 ? parts[1] : "";
    return candidate && folderNames.includes(candidate) ? candidate : "";
  }, []);

  const filteredActiveWorkbooks = useMemo(() => {
    const active = workbooks.filter((w) => !w.archived);
    if (!q) return active;

    return active.filter((workbook: any) => {
      if (matches(workbook?.name) || matches(workbook?.id)) return true;
      const folderNames: string[] = Array.isArray(workbook?.folders) ? workbook.folders : [];
      if (folderNames.some((f) => matches(f))) return true;
      const docs = Array.isArray(workbook?.documents) ? workbook.documents : [];
      return docs.some((d: any) => matches(d?.filename) || matches(d?.path));
    });
  }, [workbooks, q, matches]);

  // Auto-expand workbooks/folders with matches while searching; restore prior state on clear.
  useEffect(() => {
    if (!q) {
      if (prevExpandedWorkbooksRef.current) {
        setExpandedWorkbooks(prevExpandedWorkbooksRef.current);
        prevExpandedWorkbooksRef.current = null;
      }
      if (prevExpandedFoldersRef.current) {
        setExpandedFolders(prevExpandedFoldersRef.current);
        prevExpandedFoldersRef.current = null;
      }
      return;
    }

    if (!prevExpandedWorkbooksRef.current) prevExpandedWorkbooksRef.current = new Set(expandedWorkbooks);
    if (!prevExpandedFoldersRef.current) prevExpandedFoldersRef.current = new Set(expandedFolders);

    const nextExpandedWb = new Set<string>();
    const nextExpandedFolders = new Set<string>();

    for (const workbook of filteredActiveWorkbooks as any[]) {
      const wbId = String(workbook?.id || "");
      if (!wbId) continue;

      const folderNames: string[] = Array.isArray(workbook?.folders) ? workbook.folders : [];
      const docs = Array.isArray(workbook?.documents) ? workbook.documents : [];

      let workbookHasMatch = matches(workbook?.name) || matches(workbook?.id);
      if (!workbookHasMatch) {
        workbookHasMatch =
          folderNames.some((f) => matches(f)) || docs.some((d: any) => matches(d?.filename) || matches(d?.path));
      }
      if (workbookHasMatch) nextExpandedWb.add(wbId);

      for (const folderName of folderNames) {
        const folderMatch = matches(folderName);
        const inFolder = docs.filter((d: any) => getDocFolderName(d, workbook) === folderName);
        const docMatchInFolder = inFolder.some((d: any) => matches(d?.filename) || matches(d?.path));
        if (folderMatch || docMatchInFolder) {
          nextExpandedFolders.add(`${wbId}::${folderName}`);
        }
      }
    }

    setExpandedWorkbooks(nextExpandedWb);
    setExpandedFolders(nextExpandedFolders);
  }, [q, filteredActiveWorkbooks, matches, getDocFolderName]);  

  const activeWorkbooks = filteredActiveWorkbooks;
  const archivedWorkbooks = workbooks.filter((w) => w.archived);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2">
          <div className="relative">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchQuery("");
              }}
              placeholder="Search workbooks, folders, files…"
              className="w-full rounded border border-gray-200 bg-white px-2 py-1 pr-8 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid={testIds.workbooks.search.input}
            />
            {searchQuery.trim() && (
              <button
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                data-testid={testIds.workbooks.search.clear}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {loading && <div className="text-sm text-gray-500">Loading...</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}

        {activeWorkbooks.length === 0 && !loading && (
          <div className="mt-4 text-sm text-gray-500">
            {q ? "No matches." : "No workbooks yet. Right-click to create one."}
          </div>
        )}

        {activeWorkbooks.map((workbook: any) => (
          <div
            key={workbook.id}
            className={`mb-1 rounded relative ${dragOverTarget?.kind === "workbook" && dragOverTarget.workbookId === workbook.id ? "bg-blue-50 ring-1 ring-blue-300" : ""}`}
            onDrop={(e) => handleDropOnWorkbook(e, workbook.id)}
            onDragOver={(e) => handleDragOverWorkbook(e, workbook.id)}
            data-testid={testIds.workbooks.item(workbook.id)}
          >
            {dragOverTarget?.kind === "workbook" && dragOverTarget.workbookId === workbook.id && (
              <div className="pointer-events-none absolute inset-x-1 top-0.5 rounded bg-blue-600/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                Drop to move into “{workbook.name}”
              </div>
            )}
            <div
              className="group flex cursor-pointer items-center justify-between rounded p-1 hover:bg-gray-100"
              onContextMenu={(e) => handleContextMenu(e, workbook.id)}
            >
              <span
                className="flex items-center gap-1 text-sm flex-1"
                onClick={() => toggleWorkbook(workbook.id)}
                data-testid={testIds.workbooks.toggle(workbook.id)}
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
                    data-testid={testIds.workbooks.createMarkdown(workbook.id)}
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
                    data-testid={testIds.workbooks.createDocument(workbook.id)}
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
                      data-testid={testIds.workbooks.createFolder(workbook.id)}
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
                      data-testid={testIds.workbooks.action(action.id, workbook.id)}
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
                  const filteredDocs = !q
                    ? docs
                    : docs.filter((d: any) => matches(d?.filename) || matches(d?.path));
                  const topLevelDocs = (q ? filteredDocs : docs).filter((d: any) => {
                    const folder = getDocFolderName(d, workbook);
                    return !folder || !folderNames.includes(folder);
                  });

                  const visibleFolderNames = !q
                    ? folderNames
                    : folderNames.filter((folderName) => {
                        if (matches(folderName)) return true;
                        const anyInFolder = docs
                          .filter((d: any) => getDocFolderName(d, workbook) === folderName)
                          .some((d: any) => matches(d?.filename) || matches(d?.path));
                        return anyInFolder;
                      });

                  const totalDocs = (q ? filteredDocs : docs).length;
                  const hasAny = totalDocs > 0 || visibleFolderNames.length > 0;
                  if (!hasAny) return <div className="text-xs text-gray-400">No documents</div>;

                  return (
                    <div className="flex flex-col gap-0.5">
                      {visibleFolderNames.map((folderName) => {
                        const folderKey = `${workbook.id}::${folderName}`;
                        const allInFolder = docs.filter((d: any) => getDocFolderName(d, workbook) === folderName);
                        const inFolder = q
                          ? allInFolder.filter((d: any) => matches(d?.filename) || matches(d?.path) || matches(folderName))
                          : allInFolder;

                        return (
                          <div key={folderName}>
                            <div
                              className={`group flex min-w-0 cursor-pointer items-center justify-between gap-1 rounded px-1 py-0.5 text-xs text-gray-700 hover:bg-gray-100 ${
                                dragOverTarget?.kind === "folder" &&
                                dragOverTarget.workbookId === workbook.id &&
                                dragOverTarget.folderName === folderName
                                  ? "bg-blue-50 ring-1 ring-blue-300"
                                  : ""
                              }`}
                              style={{ position: "relative" }}
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
                              data-testid={testIds.workbooks.folder(workbook.id, folderName)}
                              data-folder-name={folderName}
                            >
                              {dragOverTarget?.kind === "folder" &&
                                dragOverTarget.workbookId === workbook.id &&
                                dragOverTarget.folderName === folderName && (
                                  <div className="pointer-events-none absolute right-1 top-0.5 z-10 max-w-[45%] truncate rounded bg-blue-600/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    Drop here
                                  </div>
                                )}
                              <span className="flex min-w-0 flex-1 items-center gap-1">
                                <span className="shrink-0">{expandedFolders.has(folderKey) ? "▼" : "▶"}</span>
                                <span className="shrink-0">📁</span>
                                <span className="min-w-0 flex-1 truncate">{folderName}</span>
                              </span>
                              <div className={`shrink-0 flex items-center gap-0.5 ${forceVisibleControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateMarkdownDoc(workbook.id, folderName);
                                  }}
                                  className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                  title="Create Markdown in folder"
                                  data-testid={testIds.workbooks.folderCreateMarkdown(workbook.id, folderName)}
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
                                  data-testid={testIds.workbooks.folderAddFiles(workbook.id, folderName)}
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
                                      data-testid={testIds.workbooks.folderAction(action.id, workbook.id, folderName)}
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
                                      data-testid={testIds.workbooks.doc(workbook.id, String(doc.path || doc.filename || ""))}
                                    >
                                      <span className="flex min-w-0 items-center gap-1 truncate">
                                        <span className="shrink-0">{getFileTypeIcon(doc.filename, { size: "xs" })}</span>
                                        <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
                                      </span>
                                      <div className={`flex items-center gap-0.5 ${forceVisibleControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRenameDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                                          }}
                                          className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                          title="Rename"
                                          aria-label="Rename"
                                          data-testid={testIds.workbooks.docRename(workbook.id, getDocRelativePath(doc))}
                                        >
                                          <PencilIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                                          }}
                                          className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                                          title="Move"
                                          aria-label="Move"
                                          data-testid={testIds.workbooks.docMove(workbook.id, getDocRelativePath(doc))}
                                        >
                                          <MoveIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                                          }}
                                          className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-red-700"
                                          title="Delete"
                                          aria-label="Delete"
                                          data-testid={testIds.workbooks.docDelete(workbook.id, getDocRelativePath(doc))}
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
                          data-testid={testIds.workbooks.doc(workbook.id, String(doc.path || doc.filename || ""))}
                        >
                          <span className="flex min-w-0 items-center gap-1 truncate">
                            <span className="shrink-0">{getFileTypeIcon(doc.filename, { size: "xs" })}</span>
                            <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
                          </span>
                          <div className={`flex items-center gap-0.5 ${forceVisibleControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                              }}
                              className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                              title="Rename"
                              aria-label="Rename"
                              data-testid={testIds.workbooks.docRename(workbook.id, getDocRelativePath(doc))}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                              }}
                              className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                              title="Move"
                              aria-label="Move"
                              data-testid={testIds.workbooks.docMove(workbook.id, getDocRelativePath(doc))}
                            >
                              <MoveIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDocument(workbook.id, getDocRelativePath(doc), doc.filename);
                              }}
                              className="flex items-center justify-center rounded p-0.5 text-gray-600 hover:bg-gray-200 hover:text-red-700"
                              title="Delete"
                              aria-label="Delete"
                              data-testid={testIds.workbooks.docDelete(workbook.id, getDocRelativePath(doc))}
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
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={() => handleRenameWorkbook(contextMenu.workbookId)}
              title="Rename workbook"
            >
              <PencilIcon className="h-4 w-4 text-gray-600" />
              Rename
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={() => handleArchiveWorkbook(contextMenu.workbookId)}
              title="Archive workbook"
            >
              <CollapseAllIcon className="h-4 w-4 text-gray-600" />
              Archive
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-700 hover:bg-gray-100"
              onClick={() => handleDeleteWorkbook(contextMenu.workbookId)}
              title="Delete workbook"
            >
              <DeleteIcon className="h-4 w-4 text-red-700" />
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
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={() =>
                handleRenameDocument(
                  documentContextMenu.workbookId,
                  documentContextMenu.documentPath,
                  documentContextMenu.documentName,
                )
              }
              data-testid={testIds.workbooks.contextMenu.docRename}
              title="Rename document"
            >
              <PencilIcon className="h-4 w-4 text-gray-600" />
              Rename
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={() =>
                handleMoveDocument(
                  documentContextMenu.workbookId,
                  documentContextMenu.documentPath,
                  documentContextMenu.documentName,
                )
              }
              data-testid={testIds.workbooks.contextMenu.docMove}
              title="Move document"
            >
              <MoveIcon className="h-4 w-4 text-gray-600" />
              Move
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-700 hover:bg-gray-100"
              onClick={() =>
                handleDeleteDocument(
                  documentContextMenu.workbookId,
                  documentContextMenu.documentPath,
                  documentContextMenu.documentName,
                )
              }
              data-testid={testIds.workbooks.contextMenu.docDelete}
              title="Delete document"
            >
              <DeleteIcon className="h-4 w-4 text-red-700" />
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
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={() => {
                const fromWb = folderContextMenu.workbookId;
                const fromFolder = folderContextMenu.folderName;
                setFolderContextMenu(null);
                setMoveFolderDialog({ isOpen: true, sourceWorkbookId: fromWb, sourceFolderName: fromFolder });
              }}
              data-testid={testIds.workbooks.contextMenu.folderMove}
              title="Move folder"
            >
              <MoveIcon className="h-4 w-4 text-gray-600" />
              Move…
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              onClick={() => handleRenameFolder(folderContextMenu.workbookId, folderContextMenu.folderName)}
              data-testid={testIds.workbooks.contextMenu.folderRename}
              title="Rename folder"
            >
              <PencilIcon className="h-4 w-4 text-gray-600" />
              Rename
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-700 hover:bg-gray-100"
              onClick={() => handleDeleteFolder(folderContextMenu.workbookId, folderContextMenu.folderName)}
              data-testid={testIds.workbooks.contextMenu.folderDelete}
              title="Delete folder"
            >
              <DeleteIcon className="h-4 w-4 text-red-700" />
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
            const destFilename =
              targetFilename && targetFilename !== sourceName ? targetFilename : undefined;
            await window.electronAPI.file.moveToFolder(
              sourceWb,
              sourcePath,
              targetWorkbookId,
              targetFolder,
              { destFilename },
            );

            const finalFilename = destFilename || sourceName;
            const folder = (targetFolder || "").trim();
            const destRel = folder ? `documents/${folder}/${finalFilename}` : `documents/${finalFilename}`;
            updateOpenDocumentLocation({
              sourceWorkbookId: sourceWb,
              sourcePath,
              targetWorkbookId,
              targetPath: destRel,
              targetFilename: finalFilename,
            });

            await loadWorkbooks();
            setExpandedWorkbooks((prev) => new Set(prev).add(targetWorkbookId));
            if (targetFolder) {
              setExpandedFolders((prev) => new Set(prev).add(`${targetWorkbookId}::${targetFolder}`));
            }
            notifySuccess(`Moved "${sourceName}"`, "Workbooks");
          } catch (err) {
            if (isCollisionError(err)) {
              const resolution = await promptCollision({
                title: "File already exists",
                message: `A file named "${targetFilename}" already exists at the destination.`,
                defaultName: suggestRename(targetFilename),
              });

              if (resolution.action === "skip") return;
              if (resolution.action === "rename") {
                const newName = (resolution.newName || "").trim();
                if (!newName) return;
                try {
                  await window.electronAPI.file.moveToFolder(
                    sourceWb,
                    sourcePath,
                    targetWorkbookId,
                    targetFolder,
                    { destFilename: newName },
                  );
                  const folder = (targetFolder || "").trim();
                  const destRel = folder ? `documents/${folder}/${newName}` : `documents/${newName}`;
                  updateOpenDocumentLocation({
                    sourceWorkbookId: sourceWb,
                    sourcePath,
                    targetWorkbookId,
                    targetPath: destRel,
                    targetFilename: newName,
                  });
                  await loadWorkbooks();
                  notifySuccess(`Moved "${sourceName}"`, "Workbooks");
                } catch (e2) {
                  notifyError(e2 instanceof Error ? e2.message : "Failed to move document", "Workbooks");
                }
                return;
              }
              if (resolution.action === "overwrite") {
                try {
                  await window.electronAPI.file.moveToFolder(
                    sourceWb,
                    sourcePath,
                    targetWorkbookId,
                    targetFolder,
                    { overwrite: true, destFilename: targetFilename },
                  );
                  const folder = (targetFolder || "").trim();
                  const destRel = folder ? `documents/${folder}/${targetFilename}` : `documents/${targetFilename}`;
                  updateOpenDocumentLocation({
                    sourceWorkbookId: sourceWb,
                    sourcePath,
                    targetWorkbookId,
                    targetPath: destRel,
                    targetFilename: targetFilename,
                  });
                  await loadWorkbooks();
                  notifySuccess(`Moved "${sourceName}"`, "Workbooks");
                } catch (e3) {
                  notifyError(e3 instanceof Error ? e3.message : "Failed to move document", "Workbooks");
                }
                return;
              }
            }
            notifyError(err instanceof Error ? err.message : "Failed to move document", "Workbooks");
          }
        }}
      />

      <ConflictResolutionDialog
        isOpen={collisionDialog.isOpen}
        title={collisionDialog.title}
        message={collisionDialog.message}
        defaultName={collisionDialog.defaultName}
        allowApplyToAll={collisionDialog.allowApplyToAll}
        onCancel={() => {
          setCollisionDialog((prev) => ({ ...prev, isOpen: false }));
          const resolve = collisionResolverRef.current;
          collisionResolverRef.current = null;
          resolve?.({ action: "skip" });
        }}
        onResolve={(resolution) => {
          setCollisionDialog((prev) => ({ ...prev, isOpen: false }));
          const resolve = collisionResolverRef.current;
          collisionResolverRef.current = null;
          resolve?.(resolution);
        }}
      />
    </div>
  );
}
