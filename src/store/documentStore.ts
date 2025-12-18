import { create } from "zustand";
import { OpenDocument } from "../components/DocumentViewer/DocumentViewer";

interface DocumentStore {
  openDocuments: OpenDocument[];
  loadingDocuments: Set<string>;
  editingDocuments: Set<string>; // Track which documents are in edit mode
  unsavedChanges: Map<string, string>; // Track unsaved content changes
  lastOpenedDocId: string | null; // Track the most recently opened document ID

  openDocument: (doc: Omit<OpenDocument, "id">) => Promise<void>;
  closeDocument: (id: string) => void;
  updateDocumentContent: (id: string, content: string) => void;
  setEditing: (id: string, editing: boolean) => void;
  setUnsavedContent: (id: string, content: string) => void;
  clearUnsavedContent: (id: string) => void;
  hasUnsavedChanges: (id: string) => boolean;
  isEditing: (id: string) => boolean;
  updateOpenDocumentLocation: (args: {
    sourceWorkbookId: string;
    sourcePath: string;
    targetWorkbookId: string;
    targetPath: string;
    targetFilename?: string;
  }) => void;
  updateOpenDocumentsPathPrefix: (args: {
    workbookId: string;
    fromPrefix: string;
    toPrefix: string;
  }) => void;
}

let nextDocId = 1;

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  openDocuments: [],
  loadingDocuments: new Set(),
  editingDocuments: new Set(),
  unsavedChanges: new Map(),
  lastOpenedDocId: null,

  openDocument: async (doc) => {
    // Handle dashboard documents differently
    if (doc.type === "dashboard" && doc.dashboardId) {
      // Check if already open
      const existing = get().openDocuments.find(
        (d) => d.type === "dashboard" && d.dashboardId === doc.dashboardId,
      );

      if (existing) {
        // Just make it active
        set(() => ({
          lastOpenedDocId: existing.id,
        }));
        return;
      }

      // Create dashboard document immediately
      const tempDoc: OpenDocument = {
        ...doc,
        id: `doc-${nextDocId++}`,
        type: "dashboard",
        dashboardId: doc.dashboardId,
        filename: doc.filename,
        content: "",
      };

      set((state) => ({
        openDocuments: [...state.openDocuments, tempDoc],
        lastOpenedDocId: tempDoc.id,
      }));
      return;
    }

    // Handle regular documents
    if (!doc.workbookId || !doc.path) {
      console.error("Cannot open document: missing workbookId or path");
      return;
    }

    const docKey = `${doc.workbookId}:${doc.path}`;

    // Check if already open
    const existing = get().openDocuments.find(
      (d) => d.workbookId === doc.workbookId && d.path === doc.path,
    );

    if (existing) {
      // Update existing document metadata and make it active.
      // Important: if the document is already open and the caller did not provide new content,
      // re-read from disk (unless there are unsaved changes) so notebook-generated outputs
      // like `trade/results/summary.json` show up immediately without a manual refresh.
      set((state) => ({
        openDocuments: state.openDocuments.map((d) =>
          d.id === existing.id ? { ...d, ...doc } : d,
        ),
        lastOpenedDocId: existing.id,
      }));

      // Only auto-reload when:
      // - content was not explicitly provided by caller
      // - no unsaved changes (avoid stomping edits)
      // - not in edit mode
      if (
        doc.content === undefined &&
        !get().hasUnsavedChanges(existing.id) &&
        !get().isEditing(existing.id)
      ) {
        const docKey = `${doc.workbookId}:${doc.path}`;
        // Mark as loading (best-effort)
        set((state) => ({
          loadingDocuments: new Set(state.loadingDocuments).add(docKey),
        }));

        try {
          const content = await window.electronAPI.file.read(doc.workbookId!, doc.path!);
          const newLoadingSet = new Set(get().loadingDocuments);
          newLoadingSet.delete(docKey);
          set((state) => ({
            openDocuments: state.openDocuments.map((d) =>
              d.id === existing.id ? { ...d, content } : d,
            ),
            loadingDocuments: newLoadingSet,
          }));
        } catch (error) {
          console.warn("Failed to reload open document:", error);
          const newLoadingSet = new Set(get().loadingDocuments);
          newLoadingSet.delete(docKey);
          set(() => ({
            loadingDocuments: newLoadingSet,
          }));
        }
      }
      return;
    }

    // Check if already loading
    if (get().loadingDocuments.has(docKey)) {
      return;
    }

    // Mark as loading
    set((state) => ({
      loadingDocuments: new Set(state.loadingDocuments).add(docKey),
    }));

    // Create document immediately (without content) for instant UI feedback
    // Use undefined to distinguish "not loaded" from "empty string"
    const tempDoc: OpenDocument = {
      ...doc,
      id: `doc-${nextDocId++}`,
      type: doc.type || "document",
      content: doc.content !== undefined ? doc.content : undefined,
    };

    set((state) => ({
      openDocuments: [...state.openDocuments, tempDoc],
      lastOpenedDocId: tempDoc.id,
    }));

    // Load content asynchronously if not provided (undefined means not provided, "" means empty)
    if (doc.content === undefined) {
      // Use requestIdleCallback or setTimeout to yield to browser, preventing blocking
      // This allows the UI to update immediately before loading file content
        const loadContent = async () => {
        try {
          const content = await window.electronAPI.file.read(doc.workbookId!, doc.path!);

          // Update document with content
          const newLoadingSet = new Set(get().loadingDocuments);
          newLoadingSet.delete(docKey);
          set((state) => ({
            openDocuments: state.openDocuments.map((d) =>
              d.id === tempDoc.id ? { ...d, content } : d,
            ),
            loadingDocuments: newLoadingSet,
          }));
        } catch (error) {
          console.error("Failed to load document:", error);
          const newLoadingSet = new Set(get().loadingDocuments);
          newLoadingSet.delete(docKey);
          set((state) => ({
            openDocuments: state.openDocuments.map((d) =>
              d.id === tempDoc.id ? { ...d, content: `Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}` } : d,
            ),
            loadingDocuments: newLoadingSet,
          }));
        }
      };

      // Yield to browser before loading (allows UI to update)
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => loadContent(), { timeout: 100 });
      } else {
        setTimeout(() => loadContent(), 0);
      }
    } else {
      // Content already provided, just remove loading state
      const newLoadingSet = new Set(get().loadingDocuments);
      newLoadingSet.delete(docKey);
      set(() => ({
        loadingDocuments: newLoadingSet,
      }));
    }
  },

  closeDocument: (id) =>
    set((state) => ({
      openDocuments: state.openDocuments.filter((d) => d.id !== id),
    })),

  updateDocumentContent: (id, content) =>
    set((state) => ({
      openDocuments: state.openDocuments.map((d) =>
        d.id === id ? { ...d, content } : d,
      ),
    })),

  setEditing: (id, editing) =>
    set((state) => {
      const newEditingSet = new Set(state.editingDocuments);
      if (editing) {
        newEditingSet.add(id);
      } else {
        newEditingSet.delete(id);
      }
      return { editingDocuments: newEditingSet };
    }),

  setUnsavedContent: (id, content) =>
    set((state) => {
      const newUnsaved = new Map(state.unsavedChanges);
      newUnsaved.set(id, content);
      return { unsavedChanges: newUnsaved };
    }),

  clearUnsavedContent: (id) =>
    set((state) => {
      const newUnsaved = new Map(state.unsavedChanges);
      newUnsaved.delete(id);
      return { unsavedChanges: newUnsaved };
    }),

  hasUnsavedChanges: (id) => {
    return get().unsavedChanges.has(id);
  },

  isEditing: (id) => {
    return get().editingDocuments.has(id);
  },

  updateOpenDocumentLocation: ({ sourceWorkbookId, sourcePath, targetWorkbookId, targetPath, targetFilename }) =>
    set((state) => {
      const fromKey = `${sourceWorkbookId}:${sourcePath}`;
      const toKey = `${targetWorkbookId}:${targetPath}`;

      const nextLoading = new Set(state.loadingDocuments);
      if (nextLoading.has(fromKey)) {
        nextLoading.delete(fromKey);
        nextLoading.add(toKey);
      }

      return {
        loadingDocuments: nextLoading,
        openDocuments: state.openDocuments.map((d) => {
          if (d.type === "dashboard") return d;
          if (d.workbookId === sourceWorkbookId && d.path === sourcePath) {
            return {
              ...d,
              workbookId: targetWorkbookId,
              path: targetPath,
              filename: targetFilename ?? d.filename,
            };
          }
          return d;
        }),
      };
    }),

  updateOpenDocumentsPathPrefix: ({ workbookId, fromPrefix, toPrefix }) =>
    set((state) => {
      const from = String(fromPrefix || "").replace(/\\/g, "/");
      const to = String(toPrefix || "").replace(/\\/g, "/");
      if (!from || from === to) return {};

      const nextLoading = new Set(state.loadingDocuments);
      const nextOpenDocs = state.openDocuments.map((d) => {
        if (d.type === "dashboard") return d;
        if (d.workbookId !== workbookId || !d.path) return d;
        const p = String(d.path).replace(/\\/g, "/");
        if (!p.startsWith(from)) return d;
        const newPath = to + p.slice(from.length);
        const newFilename = newPath.split("/").pop() || d.filename;

        const oldKey = `${workbookId}:${d.path}`;
        const newKey = `${workbookId}:${newPath}`;
        if (nextLoading.has(oldKey)) {
          nextLoading.delete(oldKey);
          nextLoading.add(newKey);
        }

        return { ...d, path: newPath, filename: newFilename };
      });

      return { openDocuments: nextOpenDocs, loadingDocuments: nextLoading };
    }),
}));
