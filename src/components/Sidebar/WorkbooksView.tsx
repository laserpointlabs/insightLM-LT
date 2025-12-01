import { useEffect, useState } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { useWorkbookStore } from "../../store/workbookStore";
import { ConfirmDialog } from "../ConfirmDialog";
import { InputDialog } from "../InputDialog";

export function WorkbooksView() {
  const { workbooks, setWorkbooks, loading, setLoading, error, setError } =
    useWorkbookStore();
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
  const [expandedWorkbooks, setExpandedWorkbooks] = useState<Set<string>>(
    new Set(),
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
  }, []);

  const loadWorkbooks = async () => {
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
  };

  const handleContextMenu = (e: React.MouseEvent, workbookId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, workbookId });
  };

  const handleCreateWorkbook = () => {
    if (!window.electronAPI?.workbook) {
      alert("Electron API not available");
      return;
    }

    setInputDialog({
      isOpen: true,
      title: "Create Workbook",
      defaultValue: "",
      onConfirm: async (name: string) => {
        setInputDialog({ ...inputDialog, isOpen: false });
        try {
          await window.electronAPI.workbook.create(name);
          await loadWorkbooks();
        } catch (err) {
          alert(
            err instanceof Error ? err.message : "Failed to create workbook",
          );
        }
      },
    });
  };

  const handleRenameWorkbook = (workbookId: string) => {
    if (!window.electronAPI?.workbook) {
      alert("Electron API not available");
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
        } catch (err) {
          alert(
            err instanceof Error ? err.message : "Failed to rename workbook",
          );
        }
      },
    });
  };

  const handleDeleteWorkbook = (workbookId: string) => {
    if (!window.electronAPI?.workbook) {
      alert("Electron API not available");
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
        } catch (err) {
          alert(
            err instanceof Error ? err.message : "Failed to delete workbook",
          );
        }
      },
    });
  };

  const handleArchiveWorkbook = async (workbookId: string) => {
    if (!window.electronAPI?.archive) {
      alert("Electron API not available");
      return;
    }

    try {
      await window.electronAPI.archive.workbook(workbookId);
      await loadWorkbooks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive workbook");
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

  const handleDocumentClick = (workbookId: string, doc: any) => {
    // Don't await - let it load in background to prevent blocking UI
    openDocument({
      workbookId,
      path: doc.path,
      filename: doc.filename,
    }).catch((error) => {
      console.error("Failed to open document:", error);
      alert(
        `Failed to open document: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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
      documentPath: doc.path,
      documentName: doc.filename,
    });
  };

  const handleDeleteDocument = (
    workbookId: string,
    documentPath: string,
    documentName: string,
  ) => {
    if (!window.electronAPI?.file) {
      alert("Electron API not available");
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
        } catch (err) {
          alert(
            err instanceof Error ? err.message : "Failed to delete document",
          );
        }
      },
    });
  };

  const handleAddFile = async (workbookId: string) => {
    if (!window.electronAPI?.dialog || !window.electronAPI?.file) {
      alert("Electron API not available");
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
        alert(`Successfully added ${successCount} file(s)`);
      } else {
        alert(
          `Added ${successCount} file(s), ${errorCount} failed:\n${errors.join("\n")}`,
        );
      }
    } else if (errorCount > 0) {
      alert(`Failed to add file: ${errors[0]}`);
    }
  };

  const handleDrop = async (e: React.DragEvent, workbookId: string) => {
    e.preventDefault();

    if (!window.electronAPI?.file) {
      alert("Electron API not available");
      return;
    }

    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      try {
        // In Electron, File objects from OS drag-drop have a path property
        const filePath = (file as any).path;
        if (!filePath) {
          console.warn("File path not available for:", file.name);
          continue;
        }
        await window.electronAPI.file.add(workbookId, filePath);
      } catch (err) {
        console.error("Failed to add file:", err);
        alert(
          `Failed to add file: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    await loadWorkbooks();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const activeWorkbooks = workbooks.filter((w) => !w.archived);
  const archivedWorkbooks = workbooks.filter((w) => w.archived);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 p-2">
        <h2 className="text-sm font-semibold">Workbooks</h2>
        <button
          onClick={handleCreateWorkbook}
          className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
        >
          + New
        </button>
      </div>

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
            className="mb-1"
            onDrop={(e) => handleDrop(e, workbook.id)}
            onDragOver={handleDragOver}
          >
            <div
              className="flex cursor-pointer items-center justify-between rounded p-1 hover:bg-gray-100"
              onContextMenu={(e) => handleContextMenu(e, workbook.id)}
              onClick={() => toggleWorkbook(workbook.id)}
            >
              <span className="flex items-center gap-1 text-sm">
                {expandedWorkbooks.has(workbook.id) ? "▼" : "▶"}{" "}
                {workbook.name}
              </span>
              {workbook.archived && (
                <span className="text-xs text-gray-400">(archived)</span>
              )}
            </div>
            {expandedWorkbooks.has(workbook.id) && (
              <div className="ml-4 mt-1">
                {workbook.documents.length === 0 ? (
                  <>
                    <div className="text-xs text-gray-400">No documents</div>
                    <button
                      onClick={() => handleAddFile(workbook.id)}
                      className="mt-1 px-1 text-xs text-blue-500 hover:text-blue-600"
                    >
                      + Add File
                    </button>
                  </>
                ) : (
                  <>
                    {workbook.documents
                      .filter((doc) => !doc.archived)
                      .map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex cursor-pointer items-center justify-between rounded px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                          onClick={() => handleDocumentClick(workbook.id, doc)}
                          onContextMenu={(e) =>
                            handleDocumentContextMenu(e, workbook.id, doc)
                          }
                        >
                          <span>📄 {doc.filename}</span>
                        </div>
                      ))}
                    <button
                      onClick={() => handleAddFile(workbook.id)}
                      className="mt-1 px-1 text-xs text-blue-500 hover:text-blue-600"
                    >
                      + Add File
                    </button>
                  </>
                )}
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
              className="block w-full px-3 py-1 text-left text-sm text-red-600 hover:bg-gray-100"
              onClick={() =>
                handleDeleteDocument(
                  documentContextMenu.workbookId,
                  documentContextMenu.documentPath,
                  documentContextMenu.documentName,
                )
              }
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
    </div>
  );
}
