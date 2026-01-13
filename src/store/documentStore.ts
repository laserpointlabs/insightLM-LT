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
  /**
   * Refresh open documents from disk when we receive a workbook files-changed event.
   * Safety: does NOT overwrite tabs with unsaved changes.
   */
  refreshOpenDocumentsForWorkbook: (workbookId: string) => Promise<{ refreshed: number; skippedDirty: number }>;
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
type RefreshResult = { refreshed: number; skippedDirty: number };
const refreshDebounceByWorkbook = new Map<
  string,
  { timer: any; promise: Promise<RefreshResult>; resolve: (r: RefreshResult) => void }
>();

async function runRefresh(
  workbookId: string,
  get: () => DocumentStore,
  set: any,
): Promise<RefreshResult> {
  const wb = String(workbookId || "").trim();
  if (!wb) return { refreshed: 0, skippedDirty: 0 };

  const { openDocuments } = get();
  const targets = openDocuments.filter(
    (d) => d.type !== "dashboard" && d.type !== "chat" && d.workbookId === wb && !!d.path,
  );
  if (!targets.length) return { refreshed: 0, skippedDirty: 0 };

  let refreshed = 0;
  let skippedDirty = 0;

  for (const doc of targets) {
    if (!doc.workbookId || !doc.path) continue;
    if (get().hasUnsavedChanges(doc.id)) {
      skippedDirty += 1;
      continue;
    }
    try {
      const content = await window.electronAPI.file.read(doc.workbookId, doc.path);
      set((state: DocumentStore) => ({
        openDocuments: state.openDocuments.map((d) => (d.id === doc.id ? { ...d, content } : d)),
      }));
      refreshed += 1;
    } catch {
      // ignore: best-effort refresh
    }
  }

  return { refreshed, skippedDirty };
}

const OPEN_TABS_STORAGE_KEY = "insightlm.openTabs.v1";

type PersistedTab =
  | { type: "chat"; chatKey: string; filename: string }
  | { type: "document"; workbookId: string; path: string; filename: string }
  | { type: "dashboard"; dashboardId: string; filename: string }
  | { type: "config"; configKey: string; filename: string };

function readPersistedTabs(): PersistedTab[] {
  try {
    const raw = localStorage.getItem(OPEN_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t: any) => {
        if (t?.type === "chat") {
          const chatKey = String(t?.chatKey || "main").trim() || "main";
          const filename = String(t?.filename || "Chat").trim() || "Chat";
          return { type: "chat", chatKey, filename } as PersistedTab;
        }
        if (t?.type === "document") {
          const workbookId = String(t?.workbookId || "").trim();
          const p = String(t?.path || "").trim();
          const filename = String(t?.filename || "").trim() || (p.split("/").pop() || p || "Document");
          if (!workbookId || !p) return null;
          return { type: "document", workbookId, path: p, filename } as PersistedTab;
        }
        if (t?.type === "dashboard") {
          const dashboardId = String(t?.dashboardId || "").trim();
          const filename = String(t?.filename || "Dashboard").trim() || "Dashboard";
          if (!dashboardId) return null;
          return { type: "dashboard", dashboardId, filename } as PersistedTab;
        }
        if (t?.type === "config") {
          const configKey = String(t?.configKey || "").trim();
          const filename = String(t?.filename || "config").trim() || "config";
          if (!configKey) return null;
          return { type: "config", configKey, filename } as PersistedTab;
        }
        return null;
      })
      .filter(Boolean) as PersistedTab[];
  } catch {
    return [];
  }
}

function writePersistedTabs(tabs: PersistedTab[]) {
  try {
    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // ignore
  }
}

function sameTab(a: PersistedTab, b: PersistedTab): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "chat") return a.chatKey === (b as any).chatKey;
  if (a.type === "document") return a.workbookId === (b as any).workbookId && a.path === (b as any).path;
  if (a.type === "dashboard") return a.dashboardId === (b as any).dashboardId;
  if (a.type === "config") return a.configKey === (b as any).configKey;
  return false;
}

function persistTabOpen(tab: PersistedTab) {
  const tabs = readPersistedTabs().filter((t) => !sameTab(t, tab));
  tabs.push(tab);
  writePersistedTabs(tabs);
}

function persistTabClosed(tab: PersistedTab) {
  const tabs = readPersistedTabs().filter((t) => !sameTab(t, tab));
  writePersistedTabs(tabs);
}

function persistTabsReplace(match: (t: PersistedTab) => boolean, replaceWith: (t: PersistedTab) => PersistedTab) {
  const tabs = readPersistedTabs().map((t) => (match(t) ? replaceWith(t) : t));
  writePersistedTabs(tabs);
}

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

      try {
        persistTabOpen({ type: "dashboard", dashboardId: String(doc.dashboardId), filename: tempDoc.filename || "Dashboard" });
      } catch {
        // ignore
      }
      return;
    }

    // Handle chat documents ("pop out" Chat to a main tab)
    if (doc.type === "chat") {
      const key = (doc as any).chatKey || "main";
      const existing = get().openDocuments.find((d: any) => d.type === "chat" && d.chatKey === key);
      if (existing) {
        set(() => ({ lastOpenedDocId: existing.id }));
        return;
      }

      const tempDoc: OpenDocument = {
        ...doc,
        id: `doc-${nextDocId++}`,
        type: "chat",
        chatKey: key,
        filename: doc.filename || "Chat",
        content: "",
      } as any;

      set((state) => ({
        openDocuments: [...state.openDocuments, tempDoc],
        lastOpenedDocId: tempDoc.id,
      }));

      try {
        persistTabOpen({ type: "chat", chatKey: String(key || "main"), filename: tempDoc.filename || "Chat" });
      } catch {
        // ignore
      }
      return;
    }

    // Handle config documents (raw YAML editors, etc.)
    if (doc.type === "config" && doc.configKey) {
      const existing = get().openDocuments.find(
        (d) => d.type === "config" && d.configKey === doc.configKey,
      );
      if (existing) {
        set(() => ({ lastOpenedDocId: existing.id }));
        return;
      }

      const docKey = `config:${doc.configKey}`;
      if (get().loadingDocuments.has(docKey)) return;

      set((state) => ({
        loadingDocuments: new Set(state.loadingDocuments).add(docKey),
      }));

      const tempDoc: OpenDocument = {
        ...doc,
        id: `doc-${nextDocId++}`,
        type: "config",
        filename: doc.filename || (doc.configKey === "llm" ? "llm.yaml" : "config.yaml"),
        path: doc.path || (doc.configKey === "llm" ? "config/llm.yaml" : "config/config.yaml"),
        content: undefined,
      };

      set((state) => ({
        openDocuments: [...state.openDocuments, tempDoc],
        lastOpenedDocId: tempDoc.id,
      }));

      try {
        persistTabOpen({
          type: "config",
          configKey: String(doc.configKey),
          filename: tempDoc.filename || "config",
        });
      } catch {
        // ignore
      }

      // Load content
      const loadContent = async () => {
        try {
          let content = "";
          if (doc.configKey === "llm") {
            if (!window.electronAPI?.config?.getLLMRaw) throw new Error("Config API not available");
            const res = await window.electronAPI.config.getLLMRaw();
            content = String(res?.content ?? "");
          }

          const newLoadingSet = new Set(get().loadingDocuments);
          newLoadingSet.delete(docKey);
          set((state) => ({
            openDocuments: state.openDocuments.map((d) =>
              d.id === tempDoc.id ? { ...d, content } : d,
            ),
            loadingDocuments: newLoadingSet,
          }));
        } catch (error) {
          const newLoadingSet = new Set(get().loadingDocuments);
          newLoadingSet.delete(docKey);
          set((state) => ({
            openDocuments: state.openDocuments.map((d) =>
              d.id === tempDoc.id
                ? {
                    ...d,
                    content: `Error loading config: ${
                      error instanceof Error ? error.message : "Unknown error"
                    }`,
                  }
                : d,
            ),
            loadingDocuments: newLoadingSet,
          }));
        }
      };

      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(() => loadContent(), { timeout: 100 });
      } else {
        setTimeout(() => loadContent(), 0);
      }
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

    try {
      persistTabOpen({
        type: "document",
        workbookId: String(doc.workbookId),
        path: String(doc.path),
        filename: String(doc.filename || tempDoc.filename || "").trim() || (String(doc.path).split("/").pop() || String(doc.path)),
      });
    } catch {
      // ignore
    }

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
              d.id === tempDoc.id ? { ...d, content, loadError: undefined } : d,
            ),
            loadingDocuments: newLoadingSet,
          }));
        } catch (error) {
          console.error("Failed to load document:", error);
          const newLoadingSet = new Set(get().loadingDocuments);
          newLoadingSet.delete(docKey);
          const msg = `Error loading file: ${error instanceof Error ? error.message : "Unknown error"}`;
          set((state) => ({
            openDocuments: state.openDocuments.map((d) =>
              d.id === tempDoc.id ? { ...d, content: "", loadError: msg } : d,
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
    set((state) => {
      const closing = state.openDocuments.find((d) => d.id === id);
      try {
        if ((closing as any)?.type === "chat") {
          persistTabClosed({ type: "chat", chatKey: String((closing as any)?.chatKey || "main"), filename: String(closing?.filename || "Chat") });
        } else if ((closing as any)?.type === "dashboard" && (closing as any)?.dashboardId) {
          persistTabClosed({ type: "dashboard", dashboardId: String((closing as any)?.dashboardId), filename: String(closing?.filename || "Dashboard") });
        } else if ((closing as any)?.type === "config" && (closing as any)?.configKey) {
          persistTabClosed({ type: "config", configKey: String((closing as any)?.configKey), filename: String(closing?.filename || "config") });
        } else if ((closing as any)?.workbookId && (closing as any)?.path) {
          persistTabClosed({
            type: "document",
            workbookId: String((closing as any)?.workbookId),
            path: String((closing as any)?.path),
            filename: String(closing?.filename || "Document"),
          });
        }
      } catch {
        // ignore
      }
      const remaining = state.openDocuments.filter((d) => d.id !== id);
      const nextLast =
        state.lastOpenedDocId === id
          ? (remaining.length ? remaining[remaining.length - 1].id : null)
          : state.lastOpenedDocId;
      return { openDocuments: remaining, lastOpenedDocId: nextLast };
    }),

  refreshOpenDocumentsForWorkbook: async (workbookId: string) => {
    const wb = String(workbookId || "").trim();
    if (!wb) return { refreshed: 0, skippedDirty: 0 };

    // Debounce event storms (e.g., many writes during tool loops): do ONE trailing refresh.
    const existing = refreshDebounceByWorkbook.get(wb);
    if (existing) {
      try {
        clearTimeout(existing.timer);
      } catch {
        // ignore
      }
      existing.timer = setTimeout(async () => {
        const res = await runRefresh(wb, get, set);
        existing.resolve(res);
        refreshDebounceByWorkbook.delete(wb);
      }, 200);
      return existing.promise;
    }

    let resolve!: (r: RefreshResult) => void;
    const promise = new Promise<RefreshResult>((r) => (resolve = r));
    const entry = {
      timer: setTimeout(async () => {
        const res = await runRefresh(wb, get, set);
        resolve(res);
        refreshDebounceByWorkbook.delete(wb);
      }, 200),
      promise,
      resolve,
    };
    refreshDebounceByWorkbook.set(wb, entry);
    return promise;
  },

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
            try {
              persistTabsReplace(
                (t) => t.type === "document" && t.workbookId === sourceWorkbookId && t.path === sourcePath,
                (t) => ({
                  ...t,
                  workbookId: targetWorkbookId,
                  path: targetPath,
                  filename: targetFilename ?? (t as any).filename,
                  type: "document",
                }) as any,
              );
            } catch {
              // ignore
            }
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

        try {
          persistTabsReplace(
            (t) => t.type === "document" && t.workbookId === workbookId && t.path === d.path,
            (t) => ({ ...t, path: newPath, filename: newFilename, type: "document" } as any),
          );
        } catch {
          // ignore
        }

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

// When dev data is reset, the on-disk files are deleted but the renderer may still have persisted tabs
// pointing at now-missing documents. Clear persisted tabs + close open docs so we don't show misleading
// "failed to parse notebook" states.
try {
  if (typeof window !== "undefined") {
    window.addEventListener("demos:changed", (evt: any) => {
      const t = evt?.detail?.type;
      if (t !== "dev_data_reset") return;
      try {
        localStorage.removeItem(OPEN_TABS_STORAGE_KEY);
      } catch {
        // ignore
      }
      try {
        useDocumentStore.setState({
          openDocuments: [],
          loadingDocuments: new Set(),
          editingDocuments: new Set(),
          unsavedChanges: new Map(),
          lastOpenedDocId: null,
        });
      } catch {
        // ignore
      }
    });
  }
} catch {
  // ignore
}
