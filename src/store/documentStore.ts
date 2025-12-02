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
}

let nextDocId = 1;

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  openDocuments: [],
  loadingDocuments: new Set(),
  editingDocuments: new Set(),
  unsavedChanges: new Map(),
  lastOpenedDocId: null,

  openDocument: async (doc) => {
    const docKey = `${doc.workbookId}:${doc.path}`;

    // Check if already open
    const existing = get().openDocuments.find(
      (d) => d.workbookId === doc.workbookId && d.path === doc.path,
    );

    if (existing) {
      // Just update the existing document and make it active
      set((state) => ({
        openDocuments: state.openDocuments.map((d) =>
          d.id === existing.id ? { ...d, ...doc } : d,
        ),
        lastOpenedDocId: existing.id,
      }));
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
    const tempDoc: OpenDocument = {
      ...doc,
      id: `doc-${nextDocId++}`,
      content: doc.content || "",
    };

    set((state) => ({
      openDocuments: [...state.openDocuments, tempDoc],
      lastOpenedDocId: tempDoc.id,
    }));

    // Load content asynchronously if not provided
    if (!doc.content) {
      // Use requestIdleCallback or setTimeout to yield to browser, preventing blocking
      // This allows the UI to update immediately before loading file content
        const loadContent = async () => {
        try {
          const content = await window.electronAPI.file.read(doc.workbookId, doc.path);

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
      set((state) => ({
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
}));
