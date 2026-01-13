import React, { useState, useEffect, useCallback, useRef } from "react";
import { MarkdownViewer } from "./MarkdownViewer";
import { CSVViewer } from "./CSVViewer";
import { PDFViewer } from "./PDFViewer";
import { TextViewer } from "./TextViewer";
import { DashboardViewer } from "./DashboardViewer";
import { Chat } from "../Sidebar/Chat";
import { UnsavedChangesDialog } from "../UnsavedChangesDialog";
import { ResizablePane } from "../ResizablePane";
import { useDocumentStore } from "../../store/documentStore";
import { extensionRegistry } from "../../services/extensionRegistry";
import { notifyError, notifySuccess } from "../../utils/notify";
import { testIds } from "../../testing/testIds";
import { getFileTypeIcon } from "../../utils/fileTypeIcon";
import { ChatIcon, DashboardIcon } from "../Icons";

class ViewerErrorBoundary extends React.Component<
  { filename?: string; onCloseCurrent?: () => void; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("DocumentViewer: Uncaught viewer error", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4" data-testid={testIds.documentViewer.error}>
          <div className="text-sm font-semibold text-red-600">Failed to render document</div>
          <div className="mt-1 text-xs text-gray-600">{this.props.filename || "Unknown file"}</div>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-800">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-black"
              onClick={() => this.setState({ error: null })}
            >
              Retry
            </button>
            {this.props.onCloseCurrent && (
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                data-testid={testIds.documentViewer.errorClose}
                onClick={() => this.props.onCloseCurrent?.()}
              >
                Close tab
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children as any;
  }
}

// Component to handle async component loading
function AsyncComponentLoader({ componentPromise, props }: { componentPromise: Promise<any>, props: any }) {
  const [Component, setComponent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    componentPromise
      .then((LoadedComponent) => {
        console.log('AsyncComponentLoader: Component loaded successfully');
        setComponent(() => LoadedComponent);
      })
      .catch((err) => {
        console.error('AsyncComponentLoader: Failed to load component:', err);
        setError(err.message);
      });
  }, [componentPromise]);

  if (error) {
    return <div className="p-4 text-red-500">Error loading component: {error}</div>;
  }

  if (!Component) {
    return <div className="p-4 text-gray-500">Loading component...</div>;
  }

  return <Component {...props} />;
}

export interface OpenDocument {
  id: string;
  workbookId?: string; // Optional for dashboards
  path?: string; // Optional for dashboards
  filename: string;
  content?: string;
  /** If set, the document failed to load from disk (e.g. file missing). */
  loadError?: string;
  type?: "document" | "dashboard" | "config" | "chat"; // Document type
  dashboardId?: string; // For dashboard documents
  configKey?: "llm"; // For config documents
  chatKey?: string; // For chat documents
}

interface DocumentViewerProps {
  documents: OpenDocument[];
  onClose: (id: string) => void;
  onJumpToContexts?: () => void;
}

export function DocumentViewer({ documents, onClose, onJumpToContexts }: DocumentViewerProps) {
  type GroupId = "a" | "b";
  type PersistedTabIdentity =
    | { type: "chat"; chatKey: string }
    | { type: "document"; workbookId: string; path: string }
    | { type: "dashboard"; dashboardId: string }
    | { type: "config"; configKey: string };
  type PersistedSplitLayout = {
    version: 1;
    mode: "single" | "right" | "down";
    splitSizePx: number;
    focusedGroup: GroupId;
    groupA: PersistedTabIdentity[];
    groupB: PersistedTabIdentity[];
    activeA?: PersistedTabIdentity | null;
    activeB?: PersistedTabIdentity | null;
  };
  const SPLIT_STORAGE_KEY = "insightlm.editorSplit.v1";
  const [, forceExtensionUpdate] = useState(0);
  const {
    hasUnsavedChanges,
    setUnsavedContent,
    clearUnsavedContent,
    updateDocumentContent,
    unsavedChanges,
    lastOpenedDocId,
  } = useDocumentStore();

  const [splitMode, setSplitMode] = useState<"single" | "right" | "down">("single");
  const [focusedGroup, setFocusedGroup] = useState<GroupId>("a");
  const [groupAIds, setGroupAIds] = useState<string[]>(() => documents.map((d) => d.id));
  const [groupBIds, setGroupBIds] = useState<string[]>([]);
  const [activeAId, setActiveAId] = useState<string | null>(() => (documents[0]?.id ? documents[0].id : null));
  const [activeBId, setActiveBId] = useState<string | null>(null);
  const [splitSizePx, setSplitSizePx] = useState<number>(520);
  const didHydrateSplitRef = useRef(false);
  const [splitHydrateNonce, setSplitHydrateNonce] = useState(0);
  const suppressActiveTabPersistRef = useRef(false);

  const allIds = useRef<Set<string>>(new Set());
  allIds.current = new Set(documents.map((d) => d.id));

  const focusedActiveId = focusedGroup === "a" ? activeAId : activeBId;
  const focusedActiveDoc = focusedActiveId ? documents.find((d) => d.id === focusedActiveId) : undefined;

  const [unsavedCloseDialog, setUnsavedCloseDialog] = useState<{
    isOpen: boolean;
    docIds: string[];
    idx: number;
    mode: "single" | "bulk";
  }>({ isOpen: false, docIds: [], idx: 0, mode: "single" });

  const [tabContextMenu, setTabContextMenu] = useState<null | { x: number; y: number; docId: string; group: GroupId }>(
    null,
  );

  const getFileExtension = (filename: string): string => filename.split(".").pop()?.toLowerCase() || "";

  const isEditableFileType = (ext: string): boolean => {
    const binaryTypes = [
      "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
      "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "tiff", "tif",
      "zip", "rar", "7z", "tar", "gz", "bz2",
      "mp3", "mp4", "avi", "mov", "wmv", "flv", "webm", "ogg",
      "exe", "dll", "so", "dylib", "bin",
    ];
    if (!ext) return true;
    return !binaryTypes.includes(ext.toLowerCase());
  };

  const saveDocById = useCallback(
    async (docId: string) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;
      if (doc.type === "dashboard" || doc.type === "chat") return;
      const ext = getFileExtension(doc.filename || "");
      if (!isEditableFileType(ext)) return;

      const contentToSave = unsavedChanges.get(docId) ?? doc.content ?? "";
      if (doc.type === "config" && (doc as any).configKey === "llm") {
        if (!window.electronAPI?.config?.saveLLMRaw) throw new Error("Config API not available");
        await window.electronAPI.config.saveLLMRaw(contentToSave);
      } else {
        if (!doc.workbookId || !doc.path) throw new Error("Missing workbookId/path");
        await window.electronAPI.file.write(doc.workbookId, doc.path, contentToSave);
      }
      updateDocumentContent(docId, contentToSave);
      clearUnsavedContent(docId);
    },
    [documents, unsavedChanges, updateDocumentContent, clearUnsavedContent],
  );

  const closeDocGuarded = useCallback(
    (docId: string) => {
      if (hasUnsavedChanges(docId)) {
        setUnsavedCloseDialog({ isOpen: true, docIds: [docId], idx: 0, mode: "single" });
        return;
      }
      onClose(docId);
    },
    [hasUnsavedChanges, onClose],
  );

  const closeManyGuarded = useCallback(
    (docIds: string[]) => {
      const ids = Array.from(new Set(docIds)).filter(Boolean);
      if (!ids.length) return;
      const firstDirtyIdx = ids.findIndex((id) => hasUnsavedChanges(id));
      if (firstDirtyIdx >= 0) {
        setUnsavedCloseDialog({ isOpen: true, docIds: ids, idx: firstDirtyIdx, mode: "bulk" });
        return;
      }
      for (const id of ids) onClose(id);
    },
    [hasUnsavedChanges, onClose],
  );

  const handleContentChangeForDoc = (docId: string, newContent: string) => {
    setUnsavedContent(docId, newContent);
  };

  function toPersistedTabIdentity(doc: OpenDocument): any {
    const type = (doc?.type || "document") as any;
    if (type === "chat") return { type: "chat", chatKey: String(doc?.chatKey || "main").trim() || "main" };
    if (type === "dashboard") return doc?.dashboardId ? { type: "dashboard", dashboardId: String(doc.dashboardId) } : null;
    if (type === "config") return doc?.configKey ? { type: "config", configKey: String(doc.configKey) } : null;
    if (!doc?.workbookId || !doc?.path) return null;
    return { type: "document", workbookId: String(doc.workbookId), path: String(doc.path) };
  }

  const identityForDocId = useCallback(
    (docId: string): PersistedTabIdentity | null => {
      const doc = documents.find((d) => d.id === docId);
      const ident = doc ? (toPersistedTabIdentity(doc) as PersistedTabIdentity | null) : null;
      return ident || null;
    },
    [documents],
  );

  const docIdForIdentity = useCallback(
    (ident: PersistedTabIdentity): string | null => {
      const t = ident?.type;
      for (const d of documents) {
        const dt = (d.type || "document") as any;
        if (t === "chat" && dt === "chat" && String((d as any).chatKey || "main") === String((ident as any).chatKey || "main")) {
          return d.id;
        }
        if (t === "dashboard" && dt === "dashboard" && String((d as any).dashboardId || "") === String((ident as any).dashboardId || "")) {
          return d.id;
        }
        if (t === "config" && dt === "config" && String((d as any).configKey || "") === String((ident as any).configKey || "")) {
          return d.id;
        }
        if (t === "document" && dt === "document" && String(d.workbookId || "") === String((ident as any).workbookId || "") && String(d.path || "") === String((ident as any).path || "")) {
          return d.id;
        }
      }
      return null;
    },
    [documents],
  );

  // Hydrate split layout once per renderer boot (View → Reload).
  useEffect(() => {
    if (didHydrateSplitRef.current) return;
    if (!documents.length) return;
    try {
      // During a renderer reload, App.tsx restores tabs sequentially under this flag.
      // Wait until restore completes so group mapping can see *all* tabs (otherwise we'd collapse to single and overwrite persisted split).
      if ((window as any).__insightlmRestoringTabs === true) {
        // Force a re-run after restore completes (the flag flip alone won't retrigger this effect).
        setTimeout(() => {
          if (!didHydrateSplitRef.current) setSplitHydrateNonce((n) => n + 1);
        }, 200);
        return;
      }
    } catch {
      // ignore
    }
    try {
      const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
      if (!raw) {
        didHydrateSplitRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedSplitLayout> | null;
      if (!parsed || parsed.version !== 1) {
        didHydrateSplitRef.current = true;
        return;
      }

      // Split hydration should not overwrite the project-level active tab (restore source-of-truth).
      suppressActiveTabPersistRef.current = true;
      setTimeout(() => {
        suppressActiveTabPersistRef.current = false;
      }, 0);

      const aIds = Array.isArray(parsed.groupA) ? parsed.groupA.map((x: any) => docIdForIdentity(x)).filter(Boolean) as string[] : [];
      const bIds = Array.isArray(parsed.groupB) ? parsed.groupB.map((x: any) => docIdForIdentity(x)).filter(Boolean) as string[] : [];
      const assigned = new Set<string>([...aIds, ...bIds]);
      const remaining = documents.map((d) => d.id).filter((id) => !assigned.has(id));
      const nextA = [...aIds, ...remaining];
      const nextB = [...bIds];

      const nextMode: "single" | "right" | "down" =
        parsed.mode === "right" || parsed.mode === "down"
          ? (nextB.length ? parsed.mode : "single")
          : "single";

      setSplitMode(nextMode);
      setSplitSizePx(typeof parsed.splitSizePx === "number" ? parsed.splitSizePx : 520);
      setGroupAIds(nextA);
      setGroupBIds(nextMode === "single" ? [] : nextB);

      const aActive = parsed.activeA ? docIdForIdentity(parsed.activeA as any) : null;
      const bActive = parsed.activeB ? docIdForIdentity(parsed.activeB as any) : null;
      setActiveAId(aActive || nextA[nextA.length - 1] || null);
      setActiveBId(nextMode === "single" ? null : (bActive || nextB[nextB.length - 1] || null));

      // Focus follows projectState.activeTab (source-of-truth for active tab persistence),
      // not the split-layout focusedGroup (which can drift and should never override active tab restore).
      (async () => {
        try {
          const a = await window.electronAPI?.projectState?.get?.();
          const active = (a as any)?.activeTab;
          const at = String(active?.type || "");
          let activeDocId: string | null = null;
          if (at === "chat") activeDocId = docIdForIdentity({ type: "chat", chatKey: String(active?.chatKey || "main") } as any);
          else if (at === "dashboard") activeDocId = active?.dashboardId ? docIdForIdentity({ type: "dashboard", dashboardId: String(active.dashboardId) } as any) : null;
          else if (at === "config") activeDocId = active?.configKey ? docIdForIdentity({ type: "config", configKey: String(active.configKey) } as any) : null;
          else if (at === "document") activeDocId = (active?.workbookId && active?.path)
            ? docIdForIdentity({ type: "document", workbookId: String(active.workbookId), path: String(active.path) } as any)
            : null;

          if (activeDocId && nextMode !== "single") {
            if (nextB.includes(activeDocId)) setFocusedGroup("b");
            else setFocusedGroup("a");
          }
        } catch {
          // ignore
        }
      })();
    } catch {
      // ignore
    } finally {
      didHydrateSplitRef.current = true;
    }
  }, [documents.length, docIdForIdentity, splitHydrateNonce]);

  // Persist split layout (project-scoped via session-partitioned localStorage).
  useEffect(() => {
    if (!didHydrateSplitRef.current) return;
    try {
      const groupA = groupAIds.map((id) => identityForDocId(id)).filter(Boolean) as PersistedTabIdentity[];
      const groupB = groupBIds.map((id) => identityForDocId(id)).filter(Boolean) as PersistedTabIdentity[];
      const activeA = activeAId ? identityForDocId(activeAId) : null;
      const activeB = activeBId ? identityForDocId(activeBId) : null;
      const payload: PersistedSplitLayout = {
        version: 1,
        mode: splitMode,
        splitSizePx,
        focusedGroup,
        groupA,
        groupB: splitMode === "single" ? [] : groupB,
        activeA,
        activeB: splitMode === "single" ? null : activeB,
      };
      localStorage.setItem(SPLIT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [splitMode, splitSizePx, focusedGroup, groupAIds, groupBIds, activeAId, activeBId, identityForDocId]);

  // Persist the focused active tab (project-scoped) whenever it changes.
  const lastSavedActiveKeyRef = useRef<string>("");
  useEffect(() => {
    try {
      if ((window as any).__insightlmRestoringTabs === true) return;
      if (suppressActiveTabPersistRef.current) return;
      if (!focusedActiveDoc) return;
      const ident = toPersistedTabIdentity(focusedActiveDoc);
      if (!ident) return;
      const key = JSON.stringify(ident);
      if (key === lastSavedActiveKeyRef.current) return;
      lastSavedActiveKeyRef.current = key;
      window.electronAPI?.projectState?.set?.({ activeTab: ident });
    } catch {
      // ignore
    }
  }, [focusedGroup, activeAId, activeBId, focusedActiveDoc?.id]);

  const handleSaveFocused = useCallback(async () => {
    if (!focusedActiveId) return;
    const doc = documents.find((d) => d.id === focusedActiveId);
    if (!doc) return;
    if (!isEditableFileType(getFileExtension(doc.filename))) return;
    try {
      await saveDocById(focusedActiveId);
      notifySuccess("Saved", doc.filename);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Failed to save file", doc.filename);
    }
  }, [focusedActiveId, documents, saveDocById]);

  // Ctrl+S saves the focused editor (group A or B).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveFocused();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveFocused]);

  useEffect(() => {
    const unsubscribe = extensionRegistry.subscribe(() => {
      forceExtensionUpdate((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  // Reconcile groups when documents change; if group B empties, collapse back to single.
  useEffect(() => {
    const inSet = (id: string) => allIds.current.has(id);
    setGroupAIds((prev) => prev.filter(inSet));
    setGroupBIds((prev) => prev.filter(inSet));
    setActiveAId((prev) => (prev && inSet(prev) ? prev : null));
    setActiveBId((prev) => (prev && inSet(prev) ? prev : null));
    if (splitMode !== "single") {
      const bHasAny = groupBIds.some(inSet);
      if (!bHasAny) setSplitMode("single");
    }
  }, [documents.length]);

  // Assign newly opened doc (lastOpenedDocId) to focused group if it's not already in a group.
  useEffect(() => {
    const id = lastOpenedDocId;
    if (!id) return;
    if (!allIds.current.has(id)) return;
    const inA = groupAIds.includes(id);
    const inB = groupBIds.includes(id);
    if (inA || inB) return;
    if (focusedGroup === "b" && splitMode !== "single") {
      setGroupBIds((prev) => [...prev, id]);
      setActiveBId(id);
    } else {
      setGroupAIds((prev) => [...prev, id]);
      setActiveAId(id);
      setFocusedGroup("a");
    }
  }, [lastOpenedDocId, focusedGroup, splitMode, groupAIds, groupBIds]);

  const ensureGroupsInitialized = useCallback(() => {
    if (!groupAIds.length && documents.length) {
      setGroupAIds(documents.map((d) => d.id));
      setActiveAId(documents[documents.length - 1].id);
      setFocusedGroup("a");
    }
  }, [groupAIds.length, documents]);

  const splitRight = useCallback(() => {
    ensureGroupsInitialized();
    setSplitMode("right");
  }, [ensureGroupsInitialized]);

  const splitDown = useCallback(() => {
    ensureGroupsInitialized();
    setSplitMode("down");
  }, [ensureGroupsInitialized]);

  const moveActiveToOtherGroup = useCallback(() => {
    const src: GroupId = focusedGroup;
    const dst: GroupId = src === "a" ? "b" : "a";
    if (splitMode === "single") setSplitMode("right");
    const id = src === "a" ? activeAId : activeBId;
    if (!id) return;
    if (src === "a") {
      setGroupAIds((prev) => prev.filter((x) => x !== id));
      setGroupBIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setActiveBId(id);
      setActiveAId((prev) => {
        const remaining = groupAIds.filter((x) => x !== id);
        return remaining[remaining.length - 1] || null;
      });
    } else {
      setGroupBIds((prev) => prev.filter((x) => x !== id));
      setGroupAIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setActiveAId(id);
      setActiveBId((prev) => {
        const remaining = groupBIds.filter((x) => x !== id);
        return remaining[remaining.length - 1] || null;
      });
    }
    setFocusedGroup(dst);
  }, [focusedGroup, splitMode, activeAId, activeBId, groupAIds, groupBIds]);

  const renderDocumentById = (docId: string | null) => {
    const doc = docId ? documents.find((d) => d.id === docId) : undefined;
    if (!doc) {
      return (
        <div className="flex h-full items-center justify-center text-gray-500">
          No document selected
        </div>
      );
    }

    if (doc.type === "chat") {
      return (
        <div className="h-full">
          <Chat onJumpToContexts={onJumpToContexts} chatKey={doc.chatKey || "main"} />
        </div>
      );
    }

    if (doc.type === "dashboard" && doc.dashboardId) {
      return <DashboardViewer dashboardId={doc.dashboardId} />;
    }

    if (doc.content === undefined && doc.path) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mb-2 text-gray-500">Loading document...</div>
            <div className="text-xs text-gray-400">{doc.filename}</div>
          </div>
        </div>
      );
    }

    if (doc.loadError) {
      return (
        <div className="p-4" data-testid={testIds.documentViewer.loadError}>
          <div className="text-sm font-semibold text-red-600">Failed to load file</div>
          <div className="mt-1 text-xs text-gray-600">{doc.filename}</div>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-800">
            {String(doc.loadError)}
          </pre>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
              data-testid={testIds.documentViewer.loadErrorClose}
              onClick={() => closeDocGuarded(doc.id)}
            >
              Close tab
            </button>
          </div>
        </div>
      );
    }

    const ext = getFileExtension(doc.filename);
    const editable = isEditableFileType(ext);
    const currentContent = (unsavedChanges.get(doc.id) ?? doc.content ?? "") as string;

    const fileHandlers = extensionRegistry.getFileHandlers(ext);
    if (fileHandlers.length > 0) {
      const handler = fileHandlers[0];
      try {
        const ComponentPromise = handler.component();
        if (ComponentPromise instanceof Promise) {
          return (
            <AsyncComponentLoader
              componentPromise={ComponentPromise}
              props={{
                content: currentContent,
                filename: doc.filename,
                workbookId: doc.workbookId,
                path: doc.path,
                onContentChange: (c: string) => handleContentChangeForDoc(doc.id, c),
              }}
            />
          );
        }
        return (
          <ComponentPromise
            content={currentContent}
            filename={doc.filename}
            workbookId={doc.workbookId}
            path={doc.path}
            onContentChange={(c: string) => handleContentChangeForDoc(doc.id, c)}
          />
        );
      } catch {
        // fall through to default viewer
      }
    }

    if (ext === "md" || ext === "markdown") {
      return (
        <MarkdownViewer
          content={currentContent}
          isEditing={editable}
          onContentChange={(c) => handleContentChangeForDoc(doc.id, c)}
        />
      );
    }
    if (ext === "csv") {
      return (
        <CSVViewer
          content={currentContent}
          isEditing={editable}
          onContentChange={(c) => handleContentChangeForDoc(doc.id, c)}
        />
      );
    }
    if (ext === "pdf") {
      return <PDFViewer workbookId={doc.workbookId} path={doc.path} />;
    }
    return (
      <TextViewer
        content={currentContent}
        filename={doc.filename}
        isEditing={editable}
        onContentChange={(c) => handleContentChangeForDoc(doc.id, c)}
      />
    );
  };

  const renderTabsRow = (group: GroupId, ids: string[], activeId: string | null, setActive: (id: string) => void) => {
    const rowTid = group === "a" ? testIds.documentViewer.split.tabsA : testIds.documentViewer.split.tabsB;
    return (
      <div
        className="flex items-center justify-between border-b border-gray-200 bg-gray-50"
        data-testid={rowTid}
        onMouseDown={() => setFocusedGroup(group)}
      >
        <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap">
          {ids.map((docId) => {
            const doc = documents.find((d) => d.id === docId);
            if (!doc) return null;
            return (
              <div
                key={doc.id}
                className={`flex shrink-0 cursor-pointer items-center gap-2 border-r border-gray-200 px-4 py-2 ${
                  activeId === doc.id ? "border-b-2 border-b-blue-500 bg-white" : "hover:bg-gray-100"
                }`}
                onClick={() => {
                  setFocusedGroup(group);
                  setActive(doc.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFocusedGroup(group);
                  setTabContextMenu({ x: e.clientX, y: e.clientY, docId: doc.id, group });
                }}
                data-testid={testIds.documentViewer.tab(doc.id)}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="shrink-0">
                    {doc.type === "dashboard" ? (
                      <DashboardIcon className="h-3 w-3" />
                    ) : doc.type === "chat" ? (
                      <ChatIcon className="h-3 w-3" />
                    ) : (
                      getFileTypeIcon(doc.filename, { size: "xs" })
                    )}
                  </span>
                  <span className="min-w-0 truncate">{doc.filename}</span>
                  {hasUnsavedChanges(doc.id) && <span className="ml-2 text-orange-500">●</span>}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDocGuarded(doc.id);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid={testIds.documentViewer.tabClose(doc.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1 px-2">
          <button
            type="button"
            className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100"
            title="Split Right"
            data-testid={testIds.documentViewer.split.splitRight}
            onClick={() => {
              splitRight();
              setFocusedGroup(group);
            }}
          >
            Split ▸
          </button>
          <button
            type="button"
            className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100"
            title="Split Down"
            data-testid={testIds.documentViewer.split.splitDown}
            onClick={() => {
              splitDown();
              setFocusedGroup(group);
            }}
          >
            Split ▾
          </button>
          {splitMode !== "single" && (
            <button
              type="button"
              className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100"
              title="Move active tab to other group"
              data-testid={testIds.documentViewer.split.moveToOtherGroup}
              onClick={() => {
                setFocusedGroup(group);
                moveActiveToOtherGroup();
              }}
            >
              Move ⇄
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (group: GroupId) => {
    const ids = group === "a" ? groupAIds : groupBIds;
    const activeId = group === "a" ? activeAId : activeBId;
    const setActive = (id: string) => (group === "a" ? setActiveAId(id) : setActiveBId(id));
    const groupTid = group === "a" ? testIds.documentViewer.split.groupA : testIds.documentViewer.split.groupB;
    const paneTid = group === "a" ? testIds.documentViewer.split.paneA : testIds.documentViewer.split.paneB;
    const doc = activeId ? documents.find((d) => d.id === activeId) : undefined;
    const isDirty = activeId ? hasUnsavedChanges(activeId) : false;

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid={groupTid} onMouseDown={() => setFocusedGroup(group)}>
        {renderTabsRow(group, ids, activeId, setActive)}
        {doc && doc.type !== "dashboard" && isEditableFileType(getFileExtension(doc.filename)) && isDirty && (
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2" data-testid={testIds.documentViewer.saveBar}>
            <span className="text-xs text-orange-500">Unsaved changes</span>
            <button
              onClick={() => handleSaveFocused()}
              className="ml-auto rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
              data-testid={testIds.documentViewer.saveButton}
            >
              Save (Ctrl+S)
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto" data-testid={paneTid}>
          <ViewerErrorBoundary
            key={activeId || `${group}-none`}
            filename={doc?.filename}
            onCloseCurrent={activeId ? () => closeDocGuarded(activeId) : undefined}
          >
            {renderDocumentById(activeId)}
          </ViewerErrorBoundary>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <UnsavedChangesDialog
        isOpen={unsavedCloseDialog.isOpen}
        title="Unsaved Changes"
        message="You have unsaved changes. Save before closing?"
        onCancel={() => setUnsavedCloseDialog((p) => ({ ...p, isOpen: false }))}
        onDontSave={() => {
          const docId = unsavedCloseDialog.docIds[unsavedCloseDialog.idx];
          if (docId) {
            clearUnsavedContent(docId);
            onClose(docId);
          }
          if (unsavedCloseDialog.mode === "bulk") {
            const remaining = unsavedCloseDialog.docIds.filter((id) => id !== docId);
            setUnsavedCloseDialog({ isOpen: false, docIds: [], idx: 0, mode: "single" });
            setTimeout(() => closeManyGuarded(remaining), 0);
          } else {
            setUnsavedCloseDialog({ isOpen: false, docIds: [], idx: 0, mode: "single" });
          }
        }}
        onSave={async () => {
          const docId = unsavedCloseDialog.docIds[unsavedCloseDialog.idx];
          try {
            if (docId) {
              await saveDocById(docId);
              onClose(docId);
            }
          } catch (e) {
            notifyError(e instanceof Error ? e.message : "Failed to save", "Save");
            return;
          }
          if (unsavedCloseDialog.mode === "bulk") {
            const remaining = unsavedCloseDialog.docIds.filter((id) => id !== docId);
            setUnsavedCloseDialog({ isOpen: false, docIds: [], idx: 0, mode: "single" });
            setTimeout(() => closeManyGuarded(remaining), 0);
          } else {
            setUnsavedCloseDialog({ isOpen: false, docIds: [], idx: 0, mode: "single" });
          }
        }}
      />

      {tabContextMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setTabContextMenu(null)} />
          <div
            className="fixed z-20 w-56 rounded border border-gray-200 bg-white py-1 shadow-lg"
            style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            data-testid={testIds.documentViewer.tabContextMenu}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              data-testid={testIds.documentViewer.tabContextClose}
              onClick={() => {
                const id = tabContextMenu.docId;
                setTabContextMenu(null);
                closeDocGuarded(id);
              }}
            >
              Close
            </button>
            <button
              className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              data-testid={testIds.documentViewer.tabContextCloseOthers}
              onClick={() => {
                const id = tabContextMenu.docId;
                setTabContextMenu(null);
                closeManyGuarded(documents.map((d) => d.id).filter((x) => x !== id));
              }}
            >
              Close Others
            </button>
            <button
              className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              data-testid={testIds.documentViewer.tabContextCloseSaved}
              onClick={() => {
                setTabContextMenu(null);
                closeManyGuarded(documents.map((d) => d.id).filter((id) => !hasUnsavedChanges(id)));
              }}
            >
              Close Saved
            </button>
            <button
              className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              data-testid={testIds.documentViewer.tabContextCloseAll}
              onClick={() => {
                setTabContextMenu(null);
                closeManyGuarded(documents.map((d) => d.id));
              }}
            >
              Close All
            </button>
          </div>
        </>
      )}

      {/* Wrapper keeps "active" metadata for existing automation; panes render inside. */}
      <div
        className="flex min-h-0 flex-1 overflow-hidden"
        data-testid={testIds.documentViewer.content}
        data-active-doc-id={focusedActiveId || ""}
        data-active-filename={focusedActiveDoc?.filename || ""}
        data-active-ext={
          focusedActiveDoc?.type === "chat"
            ? "chat"
            : focusedActiveDoc?.type === "dashboard"
              ? "dashboard"
              : focusedActiveDoc?.filename
                ? getFileExtension(focusedActiveDoc.filename)
                : ""
        }
        data-active-content-snippet={
          (() => {
            try {
              const d = focusedActiveDoc as any;
              const id = String(focusedActiveId || "");
              if (!d || !id) return "";
              const t = String(d?.type || "document");
              if (t === "chat" || t === "dashboard") return "";
              const raw = String(unsavedChanges.get(id) ?? d?.content ?? "");
              return raw.slice(0, 240);
            } catch {
              return "";
            }
          })()
        }
      >
        {splitMode === "single" ? (
          <div className="min-h-0 flex-1 overflow-hidden">{renderGroup("a")}</div>
        ) : splitMode === "right" ? (
          <div className="flex min-h-0 flex-1 overflow-hidden" data-testid={testIds.documentViewer.split.container}>
            <div className="min-h-0 overflow-hidden" style={{ flex: `0 0 ${Math.max(240, splitSizePx)}px` }}>
              {renderGroup("a")}
            </div>
            <ResizablePane
              direction="horizontal"
              initialSize={Math.max(240, splitSizePx)}
              minSize={240}
              maxSize={1200}
              onResize={(px) => setSplitSizePx(px)}
            />
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{renderGroup("b")}</div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-testid={testIds.documentViewer.split.container}>
            <div className="min-h-0 overflow-hidden" style={{ flex: `0 0 ${Math.max(200, splitSizePx)}px` }}>
              {renderGroup("a")}
            </div>
            <ResizablePane
              direction="vertical"
              initialSize={Math.max(200, splitSizePx)}
              minSize={200}
              maxSize={900}
              onResize={(px) => setSplitSizePx(px)}
            />
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{renderGroup("b")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
