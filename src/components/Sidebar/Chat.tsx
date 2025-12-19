import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ChatMessage } from "./ChatMessage";
import { AddIcon, HistoryIcon, GearIcon, SendIcon, PopOutIcon } from "../Icons";
import { testIds } from "../../testing/testIds";
import { notifyError, notifySuccess } from "../../utils/notify";
import { MentionItem, MentionTextInput } from "../MentionTextInput";
import { useDocumentStore } from "../../store/documentStore";
import { useLayoutStore } from "../../store/layoutStore";

type PersistedChatMessage = {
  id: string;
  seq: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  meta?: any;
};

interface ChatProps {
  onActionButton?: (button: React.ReactNode) => void;
  onJumpToContexts?: () => void;
}

export function Chat({ onActionButton, onJumpToContexts }: ChatProps = {}) {
  const [activeTab, setActiveTab] = useState<"chat" | "history" | "settings">("chat");
  const [messages, setMessages] = useState<
    PersistedChatMessage[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState<null | { status: "waiting" | "streaming"; text: string }>(null);
  const [activity, setActivity] = useState<
    Array<{ stepId: string; text: string; status: "running" | "ok" | "error"; ts: number; detail?: string }>
  >([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const unsubscribeActivityRef = useRef<null | (() => void)>(null);
  const activityRef = useRef<
    Array<{ stepId: string; text: string; status: "running" | "ok" | "error"; ts: number; detail?: string }>
  >([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const { openDocument } = useDocumentStore();
  const { collapsedViews, toggleViewCollapse } = useLayoutStore();

  const [contextPicker, setContextPicker] = useState<{
    loading: boolean;
    open: boolean;
    activeId: string | null;
    activeName: string | null;
    activeWorkbookIds: string[];
    contexts: Array<{ id: string; name: string }>;
    quickWorkbooks: Array<{ id: string; name: string }>;
    error: string | null;
  }>({
    loading: false,
    open: false,
    activeId: null,
    activeName: null,
    activeWorkbookIds: [],
    contexts: [],
    quickWorkbooks: [],
    error: null,
  });
  const [scopeChipMode, setScopeChipMode] = useState<"all" | "context">("context");
  const contextChipRef = useRef<HTMLButtonElement | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<null | { top: number; left: number; width: number }>(null);
  const ctxRefreshInFlightRef = useRef(false);
  const ctxRefreshLastRef = useRef(0);
  const scopeRefreshInFlightRef = useRef(false);
  const scopeRefreshLastRef = useRef(0);

  // Inline ref tokens:
  // Keep visible text as "@Name" so caret behaves naturally, and encode a short id in invisible separators
  // so we can map back to workbook://... on send.
  const ZW = "\u2063"; // INVISIBLE SEPARATOR
  const REF_TOKEN_RE = new RegExp(`@([^\\n${ZW}]+)${ZW}([^${ZW}]+)${ZW}`, "g");
  const refCounterRef = useRef(0);
  const refIdByInsertTextRef = useRef<Map<string, string>>(new Map());
  const [refMap, setRefMap] = useState<
    Record<string, { key: string; displayLabel: string; fullLabel: string; insertText: string; kind: string }>
  >({});

  const getOrCreateRefId = useCallback((insertText: string) => {
    const k = String(insertText || "");
    const existing = refIdByInsertTextRef.current.get(k);
    if (existing) return existing;
    const id = `r${++refCounterRef.current}`;
    refIdByInsertTextRef.current.set(k, id);
    return id;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    // Prefer scrolling the sentinel into view; fall back to forcing the scroll container.
    try {
      endRef.current?.scrollIntoView({ block: "end", behavior });
    } catch {
      // ignore
    }
    try {
      const el = chatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {
      // ignore
    }
  }, []);

  // Keep the chat pinned to bottom while messages/streaming/activity update (demo-friendly).
  useEffect(() => {
    scrollToBottom("auto");
  }, [messages.length, streaming?.text, streaming?.status, activity.length, activeTab, scrollToBottom]);
  const [contextStatus, setContextStatus] = useState<{
    loading: boolean;
    scopeMode: "all" | "context";
    activeContextId: string | null;
    activeWorkbookCount: number;
    error: string | null;
  }>({
    loading: true,
    scopeMode: "context",
    activeContextId: null,
    activeWorkbookCount: 0,
    error: null,
  });

  const handleNewChat = useCallback(() => {
    const ctx = contextStatus.activeContextId;
    if (ctx) {
      window.electronAPI?.chat?.clear?.(ctx).catch(() => {});
    }
    setActiveTab("chat");
    setMessages([]);
    setInput("");
    setRefMap({});
    refIdByInsertTextRef.current = new Map();
    refCounterRef.current = 0;
  }, [contextStatus.activeContextId]);

  const handleShowHistory = useCallback(() => {
    setActiveTab((prev) => (prev === "history" ? "chat" : "history"));
  }, []);

  const handleShowSettings = useCallback(() => {
    setActiveTab((prev) => (prev === "settings" ? "chat" : "settings"));
  }, []);

  const loadContextStatus = useCallback(async () => {
    setContextStatus((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const scopeRes = await window.electronAPI?.contextScope?.getMode?.();
      const scopeMode: "all" | "context" =
        scopeRes?.mode === "all" || scopeRes?.mode === "context"
          ? scopeRes.mode
          : "context";

      // Best-effort: we require an active context for Chat demos.
      let activeContextId: string | null = null;
      if (window.electronAPI?.mcp?.call) {
        const activeRes = await window.electronAPI.mcp.call("context-manager", "tools/call", {
          name: "get_active_context",
          arguments: {},
        });
        activeContextId = activeRes?.active?.id ?? null;
      }

      // Best-effort: count workbooks currently visible in UI scope (backend already applies scoping).
      let activeWorkbookCount = 0;
      if (window.electronAPI?.workbook?.getAll) {
        const all = await window.electronAPI.workbook.getAll();
        const arr = Array.isArray(all) ? all : [];
        activeWorkbookCount = arr.filter((w: any) => !w?.archived).length;
      }

      setContextStatus({
        loading: false,
        scopeMode,
        activeContextId,
        activeWorkbookCount,
        error: null,
      });
    } catch (e) {
      setContextStatus({
        loading: false,
        scopeMode: "context",
        activeContextId: null,
        activeWorkbookCount: 0,
        error: e instanceof Error ? e.message : "Failed to load context status",
      });
    }
  }, []);

  const refreshContextPicker = useCallback(async () => {
    const now = Date.now();
    if (ctxRefreshInFlightRef.current) return;
    // Throttle rapid event storms (e.g., many context:changed dispatches during automation).
    if (now - ctxRefreshLastRef.current < 750) return;
    ctxRefreshLastRef.current = now;
    if (!window.electronAPI?.mcp?.call) {
      setContextPicker((p) => ({
        ...p,
        loading: false,
        activeId: null,
        activeName: null,
        activeWorkbookIds: [],
        contexts: [],
        quickWorkbooks: [],
        error: "MCP unavailable",
      }));
      return;
    }
    ctxRefreshInFlightRef.current = true;
    setContextPicker((p) => ({ ...p, loading: true, error: null }));
    try {
      const [listRes, activeRes, allWb] = await Promise.all([
        window.electronAPI.mcp.call("context-manager", "tools/call", { name: "list_contexts", arguments: {} }),
        window.electronAPI.mcp.call("context-manager", "tools/call", { name: "get_active_context", arguments: {} }),
        window.electronAPI?.workbook?.getAll ? window.electronAPI.workbook.getAll() : Promise.resolve([]),
      ]);
      const contextsRaw = Array.isArray(listRes?.contexts) ? listRes.contexts : [];
      const contexts = contextsRaw
        .map((c: any) => ({ id: String(c?.id || ""), name: String(c?.name || c?.id || "") }))
        .filter((c: any) => c.id && c.name);
      contexts.sort((a: any, b: any) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      const activeId = activeRes?.active?.id ? String(activeRes.active.id) : null;
      const activeName = activeRes?.active?.name ? String(activeRes.active.name) : null;

      const activeWbIds: string[] = Array.isArray(activeRes?.active?.workbook_ids)
        ? activeRes.active.workbook_ids.map((x: any) => String(x)).filter(Boolean)
        : [];

      const wbs = Array.isArray(allWb) ? allWb : [];
      const quickWorkbooks = wbs
        .filter((w: any) => !w?.archived)
        .map((w: any) => ({ id: String(w?.id || ""), name: String(w?.name || w?.id || "") }))
        .filter((w: any) => w.id && w.name);
      quickWorkbooks.sort((a: any, b: any) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

      setContextPicker((p) => ({
        ...p,
        loading: false,
        contexts,
        activeId,
        activeName,
        activeWorkbookIds: activeWbIds,
        quickWorkbooks,
        error: null,
      }));
    } catch (e) {
      setContextPicker((p) => ({
        ...p,
        loading: false,
        contexts: [],
        activeId: null,
        activeName: null,
        activeWorkbookIds: [],
        quickWorkbooks: [],
        error: e instanceof Error ? e.message : "Failed to load contexts",
      }));
    } finally {
      ctxRefreshInFlightRef.current = false;
    }
  }, []);

  const QUICK_WB_PREFIX = "[WB] ";
  const activateQuickWorkbook = useCallback(
    async (wb: { id: string; name: string }) => {
      try {
        if (!window.electronAPI?.mcp?.call) return;
        const workbookId = String(wb?.id || "");
        const workbookName = String(wb?.name || workbookId);
        if (!workbookId) return;

        // Ensure scoped mode for deterministic demos
        try {
          await window.electronAPI?.contextScope?.setMode?.("context");
          setScopeChipMode("context");
          window.dispatchEvent(new CustomEvent("context:scoping"));
        } catch {
          // ignore
        }

        const listRes = await window.electronAPI.mcp.call("context-manager", "tools/call", {
          name: "list_contexts",
          arguments: {},
        });
        const contextsList: any[] = Array.isArray(listRes?.contexts) ? listRes.contexts : [];
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

        setContextPicker((p) => ({ ...p, open: false }));
        window.dispatchEvent(new CustomEvent("context:changed"));
        refreshContextPicker();
      } catch (e) {
        notifyError(e instanceof Error ? e.message : "Failed to activate workbook", "Chat");
      }
    },
    [refreshContextPicker],
  );

  const refreshScopeChipMode = useCallback(async () => {
    const now = Date.now();
    if (scopeRefreshInFlightRef.current) return;
    if (now - scopeRefreshLastRef.current < 500) return;
    scopeRefreshLastRef.current = now;
    scopeRefreshInFlightRef.current = true;
    try {
      const res = await window.electronAPI?.contextScope?.getMode?.();
      const m = res?.mode === "all" || res?.mode === "context" ? res.mode : "context";
      setScopeChipMode(m);
    } catch {
      setScopeChipMode("context");
    } finally {
      scopeRefreshInFlightRef.current = false;
    }
  }, []);

  const loadThread = useCallback(async () => {
    const ctxId = contextStatus.activeContextId;
    if (!ctxId) {
      setMessages([]);
      return;
    }
    try {
      const res = await window.electronAPI?.chat?.getThread?.(ctxId);
      const msgs = Array.isArray(res?.messages) ? ((res?.messages || []) as PersistedChatMessage[]) : [];
      // Ensure deterministic ordering.
      msgs.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
      setMessages(msgs);
    } catch {
      // Fail-soft: keep UI usable, just don't restore.
      setMessages([]);
    }
  }, [contextStatus.activeContextId]);

  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const loadMentionItems = useCallback(async () => {
    if (!window.electronAPI?.workbook?.getAll) {
      setMentionItems([]);
      return;
    }
    try {
      const all = await window.electronAPI.workbook.getAll();
      const workbooks = Array.isArray(all) ? all : [];
      const items: MentionItem[] = [];
      for (const wb of workbooks.filter((w: any) => !w?.archived)) {
        const wbId = String(wb?.id || "");
        if (!wbId) continue;
        const wbName = String(wb?.name || wbId);
        items.push({
          kind: "workbook",
          id: wbId,
          label: wbName,
          insertText: `workbook://${wbId}/`,
          searchText: wbName,
        });
        const folders: string[] = Array.isArray(wb?.folders) ? wb.folders : [];
        for (const folderName of folders) {
          items.push({
            kind: "folder",
            id: `${wbId}:${folderName}`,
            label: `${wbName}/${folderName}`,
            insertText: `workbook://${wbId}/documents/${folderName}/`,
            searchText: `${wbName} ${folderName}`,
          });
        }
        const docs: any[] = Array.isArray(wb?.documents) ? wb.documents : [];
        for (const doc of docs.filter((d: any) => !d?.archived)) {
          const rel = String(doc?.path || "").replace(/\\/g, "/");
          if (!rel) continue;
          const filename = String(doc?.filename || rel.split("/").pop() || rel);
          items.push({
            kind: "file",
            id: `${wbId}:${rel}`,
            label: `${wbName}/${filename}`,
            insertText: `workbook://${wbId}/${rel}`,
            searchText: `${wbName} ${filename} ${rel}`,
          });
        }
      }
      setMentionItems(items);
    } catch {
      setMentionItems([]);
    }
  }, []);

  useEffect(() => {
    if (onActionButton) {
      onActionButton(
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="New Chat"
            data-testid={testIds.chat.newChat}
          >
            <AddIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleShowHistory}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Chat History"
            data-testid={testIds.chat.history}
          >
            <HistoryIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleShowSettings}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Chat Settings"
            data-testid={testIds.chat.settings}
          >
            <GearIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              openDocument({
                type: "chat",
                chatKey: "main",
                filename: "Chat",
              } as any);

              // UX: if the user pops Chat out into a main tab, collapse the sidebar Chat view
              // so we don't show duplicate chat UIs at once.
              try {
                if (!collapsedViews.has("chat")) {
                  toggleViewCollapse("chat");
                }
              } catch {
                // ignore
              }
            }}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Pop out Chat to a tab"
            data-testid={testIds.chat.popout}
          >
            <PopOutIcon className="h-4 w-4" />
          </button>
        </div>
      );
    }
  }, [onActionButton, handleNewChat, handleShowHistory, handleShowSettings, openDocument, collapsedViews, toggleViewCollapse]);

  useEffect(() => {
    loadContextStatus();
    const onChanged = () => loadContextStatus();
    window.addEventListener("context:changed", onChanged as any);
    window.addEventListener("context:scoping", onChanged as any);
    return () => {
      window.removeEventListener("context:changed", onChanged as any);
      window.removeEventListener("context:scoping", onChanged as any);
    };
  }, [loadContextStatus]);

  useEffect(() => {
    refreshContextPicker();
    refreshScopeChipMode();
    const onChanged = () => refreshContextPicker();
    const onScope = () => refreshScopeChipMode();
    window.addEventListener("context:changed", onChanged as any);
    window.addEventListener("context:scoping", onScope as any);
    return () => {
      window.removeEventListener("context:changed", onChanged as any);
      window.removeEventListener("context:scoping", onScope as any);
    };
  }, [refreshContextPicker, refreshScopeChipMode]);

  useEffect(() => {
    if (!contextPicker.open) return;
    const updatePos = () => {
      const el = contextChipRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
      const menuH = 260;
      const margin = 6;
      const spaceBelow = viewportH - rect.bottom;
      const openUp = spaceBelow < menuH + margin;
      const width = Math.max(220, Math.min(360, rect.width + 180));
      const left = Math.max(6, Math.min(rect.left, viewportW - width - 6));
      const top = openUp ? Math.max(6, rect.top - menuH - margin) : Math.min(viewportH - 6, rect.bottom + margin);
      setContextMenuPos({ top, left, width });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [contextPicker.open]);

  useEffect(() => {
    if (!contextPicker.open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const menu = document.querySelector(`[data-testid="${testIds.chat.contextMenu}"]`);
      if (menu && menu.contains(t)) return;
      if (contextChipRef.current && contextChipRef.current.contains(t)) return;
      setContextPicker((p) => ({ ...p, open: false }));
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [contextPicker.open]);

  useEffect(() => {
    // Load persisted chat when active context changes.
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    // Mention items should reflect current scoping mode + active context.
    loadMentionItems();
    const onScope = () => loadMentionItems();
    window.addEventListener("context:changed", onScope as any);
    window.addEventListener("context:scoping", onScope as any);
    return () => {
      window.removeEventListener("context:changed", onScope as any);
      window.removeEventListener("context:scoping", onScope as any);
    };
  }, [loadMentionItems]);

  useEffect(() => {
    // Subscribe once; we filter by activeRequestIdRef.
    if (!window.electronAPI?.llm?.onActivity) return;
    if (unsubscribeActivityRef.current) return;
    unsubscribeActivityRef.current = window.electronAPI.llm.onActivity((evt: any) => {
      try {
        const rid = activeRequestIdRef.current;
        if (!rid || !evt || evt.requestId !== rid) return;

        if (evt.kind === "thinking") {
          setActivity((prev) => [
            ...prev,
            { stepId: `thinking-${evt.ts || Date.now()}`, text: evt.message || "Thinking…", status: "running", ts: evt.ts || Date.now() },
          ]);
          return;
        }
        if (evt.kind === "tool_start") {
          const args = evt.argsSummary ? ` ${evt.argsSummary}` : "";
          setActivity((prev) => [
            ...prev,
            {
              stepId: String(evt.stepId),
              text: `Using ${evt.toolName}`,
              status: "running",
              ts: evt.ts || Date.now(),
              detail: `${evt.serverName}${args ? ` · ${args}` : ""}`,
            },
          ]);
          return;
        }
        if (evt.kind === "tool_end") {
          setActivity((prev) =>
            prev.map((it) => {
              if (it.stepId !== String(evt.stepId)) return it;
              const dur = typeof evt.durationMs === "number" ? `${Math.max(0, Math.round(evt.durationMs))}ms` : undefined;
              const suffix = evt.ok ? (dur ? ` ✓ (${dur})` : " ✓") : (dur ? ` ✕ (${dur})` : " ✕");
              const detail = evt.ok ? it.detail : `${it.detail || ""}${it.detail ? " · " : ""}${String(evt.error || "Tool failed")}`;
              return { ...it, text: `${it.text}${suffix}`, status: evt.ok ? "ok" : "error", detail };
            }),
          );
        }

        // Ensure the newest activity is visible during execution without requiring manual scroll.
        // Use rAF so it runs after the DOM updates.
        try {
          requestAnimationFrame(() => scrollToBottom("auto"));
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    });
    return () => {
      try {
        unsubscribeActivityRef.current?.();
      } catch {
        // ignore
      }
      unsubscribeActivityRef.current = null;
    };
  }, [scrollToBottom]);

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  const renderActivityBlock = useCallback(
    (
      items: Array<{ stepId: string; text: string; status: "running" | "ok" | "error"; ts: number; detail?: string }>,
      defaultOpen: boolean,
    ) => {
      if (!items || items.length === 0) return null;
      return (
        <div className="mt-1 rounded-lg border border-gray-200 bg-white px-2 py-1" data-testid={testIds.chat.activity.container}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-[11px] text-gray-600"
            onClick={() => setActivityOpen((v) => (defaultOpen ? !v : !v))}
            data-testid={testIds.chat.activity.toggle}
          >
            <span className="font-semibold">Activity</span>
            <span className="text-gray-500">{(activityOpen || defaultOpen) ? "Hide" : "Show"}</span>
          </button>
          {(activityOpen || defaultOpen ? items : items).map((a) => (
            <div
              key={a.stepId}
              className="mt-1 text-[11px] text-gray-600"
              data-testid={testIds.chat.activity.item(a.stepId)}
              title={a.detail || a.text}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-[2px] inline-block h-1.5 w-1.5 rounded-full ${
                    a.status === "running" ? "bg-blue-500" : a.status === "ok" ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <div className="min-w-0">
                  <div className="whitespace-pre-wrap">{a.text}</div>
                  {a.detail && <div className="whitespace-pre-wrap text-gray-400">{a.detail}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    },
    [activityOpen],
  );

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const raw = input.trim();
    setInput("");
    setRefMap({});
    refIdByInsertTextRef.current = new Map();
    refCounterRef.current = 0;

    const ctxId = contextStatus.activeContextId;
    if (!ctxId) return;

    setLoading(true);
    setActivity([]);
    setActivityOpen(false);

    try {
      // Persist + render user message first (deterministic ordering via backend seq).
      const seen = new Set<string>();
      const usedKeys: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = REF_TOKEN_RE.exec(raw)) !== null) {
        const key = String(m[2] || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        usedKeys.push(key);
      }
      const usedRefs = usedKeys.map((k) => refMap[k]).filter(Boolean);
      const userMessage = raw
        .replace(REF_TOKEN_RE, (_all, visibleName) => `@${String(visibleName || "").trim()}`)
        .replace(new RegExp(ZW, "g"), "")
        .trim();
      const userMessageWithRefs =
        usedRefs.length > 0
          ? `${userMessage}\n\n${usedRefs.map((r) => r.insertText).join("\n")}`
          : userMessage;
      const appendedUser = await window.electronAPI?.chat?.append?.({
        contextId: ctxId,
        role: "user",
        content: userMessageWithRefs,
      });
      const userMsg = appendedUser?.message as PersistedChatMessage | undefined;
      if (userMsg) {
        setMessages((prev) => [...prev, userMsg].sort((a, b) => a.seq - b.seq));
      }

      const historyForLLM = [...messages, ...(userMsg ? [userMsg] : [])].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Show a placeholder assistant bubble immediately (while waiting on the LLM).
      setStreaming({ status: "waiting", text: "" });
      const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      activeRequestIdRef.current = requestId;
      const response = await window.electronAPI.llm.chat(historyForLLM, requestId);

      // Stream the response into the UI (typewriter) to improve perceived latency.
      // This remains deterministic/testable and works even when provider/tool-calling isn't stream-capable.
      setStreaming({ status: "streaming", text: "" });
      const full = String(response || "");
      const chunkSize = 32;
      for (let i = 0; i < full.length; i += chunkSize) {
        const next = full.slice(0, i + chunkSize);
        setStreaming({ status: "streaming", text: next });
        // Small delay; keep deterministic-ish without relying on wallclock for correctness.
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((r) => setTimeout(r, 16));
      }
      setStreaming(null);
      activeRequestIdRef.current = null;

      const appendedAssistant = await window.electronAPI?.chat?.append?.({
        contextId: ctxId,
        role: "assistant",
        content: response,
        // Persist activity trace with the assistant message (so it stays in the transcript on reload),
        // but DO NOT include it in the LLM prompt history.
        meta: activityRef.current?.length ? { activity: activityRef.current } : undefined,
      });
      const assistantMsg = appendedAssistant?.message as PersistedChatMessage | undefined;
      if (assistantMsg) {
        setMessages((prev) => [...prev, assistantMsg].sort((a, b) => a.seq - b.seq));
        }
      } catch (error) {
      setStreaming(null);
      activeRequestIdRef.current = null;
      const ctxId2 = contextStatus.activeContextId;
      if (ctxId2) {
        try {
          const appended = await window.electronAPI?.chat?.append?.({
            contextId: ctxId2,
            role: "assistant",
            content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
          });
          const assistantErr = appended?.message as PersistedChatMessage | undefined;
          if (assistantErr) {
            setMessages((prev) => [...prev, assistantErr].sort((a, b) => a.seq - b.seq));
          }
        } catch {
          // ignore
        }
      }
      } finally {
        setLoading(false);
      }
  };

  const renderedMessages = useMemo(() => messages, [messages]);

  const shouldShowScopedEmpty =
    !contextStatus.loading &&
    (!!contextStatus.error ||
      !contextStatus.activeContextId ||
      (contextStatus.scopeMode === "context" && contextStatus.activeWorkbookCount === 0));

  const emptyMessage = (() => {
    if (contextStatus.loading) return "Loading context…";
    if (contextStatus.error) return `Context unavailable: ${contextStatus.error}`;
    if (!contextStatus.activeContextId) return "Chat is scoped to an active Context. Activate a Context to start chatting.";
    if (contextStatus.scopeMode === "context" && contextStatus.activeWorkbookCount === 0) {
      return "This Context has no in-scope workbooks. Add workbooks to the active Context (or switch to a different Context).";
    }
    return "Chat is unavailable.";
  })();

  const [llmForm, setLlmForm] = useState<{
    loading: boolean;
    provider: "openai" | "claude" | "ollama";
    model: string;
    apiKey: string;
    baseUrl: string;
    error: string | null;
  }>({
    loading: false,
    provider: "openai",
    model: "gpt-4o",
    apiKey: "",
    baseUrl: "",
    error: null,
  });

  const [llmProfiles, setLlmProfiles] = useState<Record<"openai" | "claude" | "ollama", { model: string; apiKey: string; baseUrl: string }>>({
    openai: { model: "gpt-4o", apiKey: "", baseUrl: "" },
    claude: { model: "claude-3-5-sonnet-20241022", apiKey: "", baseUrl: "" },
    ollama: { model: "llama3.2:1b", apiKey: "", baseUrl: "http://localhost:11434" },
  });

  const [availableModels, setAvailableModels] = useState<Array<{ id: string; label?: string }>>([]);
  const [modelsStatus, setModelsStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });

  const loadLlmConfig = useCallback(async () => {
    if (!window.electronAPI?.config?.get) {
      setLlmForm((p) => ({ ...p, error: "Config API not available" }));
      return;
    }
    setLlmForm((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await window.electronAPI.config.get();
      const store = res?.llmStore;
      const llm = res?.llm || {};

      const activeProvider =
        store?.activeProvider === "claude" || store?.activeProvider === "ollama"
          ? store.activeProvider
          : "openai";

      const profiles = store?.profiles || {};
      const nextProfiles = {
        openai: {
          model: String(profiles?.openai?.model || "gpt-4o"),
          REDACTED || ""),
          baseUrl: "",
        },
        claude: {
          model: String(profiles?.claude?.model || "claude-3-5-sonnet-20241022"),
          REDACTED || ""),
          baseUrl: "",
        },
        ollama: {
          model: String(profiles?.ollama?.model || "llama3.2:1b"),
          REDACTED || ""),
          baseUrl: String(profiles?.ollama?.baseUrl || "http://localhost:11434"),
        },
      } as const;

      setLlmProfiles(nextProfiles as any);

      // Prefer store-derived profile; fall back to llm (active config) if store missing.
      const fallbackProvider = llm.provider === "claude" || llm.provider === "ollama" ? llm.provider : "openai";
      const effectiveProvider = store?.activeProvider ? activeProvider : fallbackProvider;
      const eff = (nextProfiles as any)[effectiveProvider] || {
        model: String(llm.model || ""),
        REDACTED || ""),
        baseUrl: String(llm.baseUrl || ""),
      };

      setLlmForm((p) => ({
        ...p,
        loading: false,
        provider: effectiveProvider,
        model: String(eff.model || ""),
        REDACTED || ""),
        baseUrl: String(eff.baseUrl || ""),
        error: null,
      }));
    } catch (e) {
      setLlmForm((p) => ({
        ...p,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load LLM config",
      }));
    }
  }, []);

  const refreshModels = useCallback(async () => {
    if (!window.electronAPI?.llm?.listModels) {
      setModelsStatus({ loading: false, error: "Model listing API not available" });
      setAvailableModels([]);
      return;
    }
    setModelsStatus({ loading: true, error: null });
    try {
      const res = await window.electronAPI.llm.listModels();
      const models = Array.isArray(res?.models) ? res.models : [];
      const normalized = models
        .map((m: any) => ({
          id: String(m?.id || "").trim(),
          label: typeof m?.label === "string" ? m.label : undefined,
        }))
        .filter((m: any) => m.id);
      normalized.sort((a: any, b: any) => a.id.localeCompare(b.id));
      setAvailableModels(normalized);
      setModelsStatus({ loading: false, error: res?.error ? String(res.error) : null });
    } catch (e) {
      setAvailableModels([]);
      setModelsStatus({ loading: false, error: e instanceof Error ? e.message : "Failed to list models" });
    }
  }, []);

  useEffect(() => {
    if (activeTab === "settings") {
      loadLlmConfig();
      // Best-effort: load models list when opening settings.
      refreshModels();
    }
  }, [activeTab, loadLlmConfig, refreshModels]);

  const saveLlmConfig = useCallback(async () => {
    if (!window.electronAPI?.config?.updateLLM) {
      notifyError("Config API not available", "Chat");
      return;
    }
    try {
      setLlmForm((p) => ({ ...p, loading: true, error: null }));
      const provider = llmForm.provider;
      const merged = {
        ...llmProfiles,
        [provider]: {
          ...llmProfiles[provider],
          model: llmForm.model,
          REDACTED
          baseUrl: llmForm.baseUrl,
        },
      } as any;

      const res = await window.electronAPI.config.updateLLM({
        activeProvider: provider,
        profiles: merged,
      });

      // Reload from returned store so UI reflects canonical persisted values.
      const store = res?.llmStore;
      if (store?.profiles) {
        setLlmProfiles({
          openai: {
            model: String(store.profiles?.openai?.model || "gpt-4o"),
            REDACTED || ""),
            baseUrl: "",
          },
          claude: {
            model: String(store.profiles?.claude?.model || "claude-3-5-sonnet-20241022"),
            REDACTED || ""),
            baseUrl: "",
          },
          ollama: {
            model: String(store.profiles?.ollama?.model || "llama3.2:1b"),
            REDACTED || ""),
            baseUrl: String(store.profiles?.ollama?.baseUrl || "http://localhost:11434"),
          },
        } as any);
      }
      notifySuccess("LLM config saved", "Chat");
      setLlmForm((p) => ({ ...p, loading: false, error: null }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save LLM config";
      setLlmForm((p) => ({ ...p, loading: false, error: msg }));
      notifyError(msg, "Chat");
    }
  }, [llmForm.provider, llmForm.model, llmForm.apiKey, llmForm.baseUrl]);

  return (
    <div className="flex h-full flex-col">
      <div ref={chatScrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {contextStatus.loading && (
          <div className="mt-4 text-center text-sm text-gray-500" data-testid={testIds.chat.emptyState.loading}>
            {emptyMessage}
          </div>
        )}

        {!contextStatus.loading && shouldShowScopedEmpty ? (
          <div
            className="mt-4 rounded border border-gray-200 bg-white p-3 text-center"
            data-testid={testIds.chat.emptyState.container}
          >
            <div className="text-sm text-gray-600" data-testid={testIds.chat.emptyState.message}>
              {emptyMessage}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                className="rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
                onClick={() => onJumpToContexts?.()}
                data-testid={testIds.chat.emptyState.jumpToContexts}
              >
                Go to Contexts
              </button>
            </div>
          </div>
        ) : activeTab === "history" ? (
          <div data-testid={testIds.chat.tabs.panelHistory}>
            {messages.length === 0 ? (
              <div className="mt-4 text-center text-sm text-gray-500">
                No chat history for this context yet.
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded border border-gray-200 bg-white p-2"
                    data-testid={testIds.chat.message(m.id)}
                    data-chat-message
                    data-role={m.role}
                    data-chat-message-id={m.id}
                  >
                    <div className="text-[10px] text-gray-500">
                      {m.role} · {new Date(m.timestamp).toLocaleString()}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-xs text-gray-800">
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "settings" ? (
          <div data-testid={testIds.chat.tabs.panelSettings} className="space-y-3">
            <div className="rounded border border-gray-200 bg-white p-3">
              <div className="text-sm font-semibold text-gray-800">LLM Provider</div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <label className="text-xs text-gray-600">
                  Provider
                  <select
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    value={llmForm.provider}
                    onChange={(e) => {
                      const nextProvider = (e.target.value as any) as "openai" | "claude" | "ollama";
                      const profile = llmProfiles[nextProvider];
                      setLlmForm((p) => ({
                        ...p,
                        provider: nextProvider,
                        model: profile?.model || p.model,
                        REDACTED || "",
                        baseUrl: profile?.baseUrl || "",
                      }));
                      // Clear stale model list when switching providers; user can Refresh.
                      setAvailableModels([]);
                      setModelsStatus({ loading: false, error: null });
                    }}
                    disabled={llmForm.loading}
                    data-testid={testIds.chat.llmConfig.provider}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude</option>
                    <option value="ollama">Ollama</option>
                  </select>
                </label>

                <label className="text-xs text-gray-600">
                  Model
                  <div className="mt-1 flex gap-2">
                    <select
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                      value={llmForm.model}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLlmForm((p) => ({ ...p, model: v }));
                        setLlmProfiles((prev) => ({
                          ...prev,
                          [llmForm.provider]: { ...prev[llmForm.provider], model: v },
                        }));
                      }}
                      disabled={llmForm.loading || modelsStatus.loading || availableModels.length === 0}
                      data-testid={testIds.chat.llmConfig.modelSelect}
                    >
                      {availableModels.length === 0 ? (
                        <option value={llmForm.model || ""}>
                          {llmForm.model ? llmForm.model : "No models loaded"}
                        </option>
                      ) : (
                        availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label ? `${m.label} (${m.id})` : m.id}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      type="button"
                      className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      onClick={refreshModels}
                      disabled={llmForm.loading || modelsStatus.loading}
                      data-testid={testIds.chat.llmConfig.refreshModels}
                    >
                      {modelsStatus.loading ? "Loading…" : "Refresh"}
                    </button>
                  </div>
                  <input
                    className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    value={llmForm.model}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLlmForm((p) => ({ ...p, model: v }));
                      setLlmProfiles((prev) => ({
                        ...prev,
                        [llmForm.provider]: { ...prev[llmForm.provider], model: v },
                      }));
                    }}
                    disabled={llmForm.loading}
                    placeholder='Manual model override (optional)'
                    data-testid={testIds.chat.llmConfig.model}
                  />
                  {modelsStatus.error && (
                    <div className="mt-1 text-[11px] text-red-600">{modelsStatus.error}</div>
                  )}
                </label>

                <label className="text-xs text-gray-600">
                  API Key (optional)
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    value={llmForm.apiKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLlmForm((p) => ({ ...p, apiKey: v }));
                      setLlmProfiles((prev) => ({
                        ...prev,
                        [llmForm.provider]: { ...prev[llmForm.provider], apiKey: v },
                      }));
                    }}
                    disabled={llmForm.loading}
                    placeholder='e.g. "${OPENAI_API_KEY}"'
                    data-testid={testIds.chat.llmConfig.apiKey}
                  />
                </label>

                <label className="text-xs text-gray-600">
                  Base URL (Ollama only)
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                    value={llmForm.baseUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLlmForm((p) => ({ ...p, baseUrl: v }));
                      setLlmProfiles((prev) => ({
                        ...prev,
                        [llmForm.provider]: { ...prev[llmForm.provider], baseUrl: v },
                      }));
                    }}
                    disabled={llmForm.loading}
                    placeholder='e.g. "http://localhost:11434"'
                    data-testid={testIds.chat.llmConfig.baseUrl}
                  />
                </label>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-gray-500" data-testid={testIds.chat.llmConfig.status}>
                    {llmForm.loading ? "Saving/loading…" : llmForm.error ? `Error: ${llmForm.error}` : "Saved to config/llm.yaml"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => {
                        openDocument({
                          type: "config",
                          configKey: "llm",
                          filename: "llm.yaml",
                          content: undefined,
                        } as any);
                      }}
                      disabled={llmForm.loading}
                      title="Edit the full llm.yaml (raw YAML) in a tab"
                    >
                      Edit YAML
                    </button>
                    <button
                      type="button"
                      className="rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                      onClick={saveLlmConfig}
                      disabled={llmForm.loading}
                      data-testid={testIds.chat.llmConfig.save}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div data-testid={testIds.chat.tabs.panelChat}>
              {renderedMessages.length === 0 && !streaming && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Start a conversation about your workbooks
          </div>
        )}
              <div className="space-y-3">
                {renderedMessages.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      data-chat-message
                      data-role={msg.role}
                      data-testid={testIds.chat.message(msg.id || String(idx))}
                      data-chat-message-id={msg.id}
                    >
                      <div className="w-full max-w-[85%]">
            <ChatMessage role={msg.role} content={msg.content} />
                        {!isUser &&
                          msg?.meta?.activity &&
                          Array.isArray(msg.meta.activity) &&
                          renderActivityBlock(msg.meta.activity, true)}
          </div>
                    </div>
                  );
                })}

                {streaming && (
                  <div
                    className="flex justify-start"
                    data-testid={testIds.chat.streaming.container}
                    data-chat-message
                    data-role="assistant"
                  >
                    <div className="w-full max-w-[85%]">
                      <div
                        className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap"
                        data-testid={testIds.chat.streaming.content}
                      >
                        {streaming.status === "waiting" && !streaming.text ? "Thinking…" : streaming.text}
                      </div>
                      {renderActivityBlock(activity, true)}
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-gray-200 px-3 py-2">
        <div className="w-full">
          <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm focus-within:ring-1 focus-within:ring-blue-500">
            <div className="relative">
              <MentionTextInput
                value={input}
                onChange={setInput}
                disabled={loading || shouldShowScopedEmpty || contextStatus.loading || activeTab !== "chat"}
                multiline
                rows={2}
                placeholder="Ask about your workbooks… (type @ to reference) — Ctrl/Cmd+Enter to send"
                containerClassName="w-full"
                className="w-full resize-none bg-transparent px-2 py-1 pr-10 text-sm leading-5 text-transparent caret-gray-900 placeholder:text-gray-400 focus:outline-none max-h-48 overflow-y-auto"
                inputTestId={testIds.chat.input}
                menuTestId={testIds.chat.mentions.menu}
                itemTestId={(it) => testIds.chat.mentions.item(it.kind, it.id)}
                mentionItems={mentionItems}
                getMentionReplacementText={(it) => {
                  const displayLabel =
                    it.kind === "file"
                      ? String(it.label).split("/").pop() || it.label
                      : it.kind === "folder"
                        ? String(it.label).split("/").pop() || it.label
                        : it.label;
                  const id = getOrCreateRefId(it.insertText || `${it.kind}:${it.id}`);
                  return `@${displayLabel}${ZW}${id}${ZW}`;
                }}
                onSelectMention={(it) => {
                  const fullLabel = it.label;
                  const displayLabel =
                    it.kind === "file"
                      ? String(it.label).split("/").pop() || it.label
                      : it.kind === "folder"
                        ? String(it.label).split("/").pop() || it.label
                        : it.label;
                  const id = getOrCreateRefId(it.insertText || `${it.kind}:${it.id}`);
                  setRefMap((prev) => ({
                    ...prev,
                    [id]: { key: id, displayLabel, fullLabel, insertText: it.insertText, kind: it.kind },
                  }));
                }}
                renderOverlay={(val) => {
                  const parts: React.ReactNode[] = [];
                  let lastIdx = 0;
                  const s = String(val || "");
                  const re = new RegExp(`@([^\\n${ZW}]+)${ZW}([^${ZW}]+)${ZW}`, "g");
                  let mm: RegExpExecArray | null;
                  while ((mm = re.exec(s)) !== null) {
                    const start = mm.index;
                    const end = start + mm[0].length;
                    const visible = String(mm[1] || "");
                    const key = String(mm[2] || "");
                    if (start > lastIdx) {
                      parts.push(<span key={`t-${lastIdx}`}>{s.slice(lastIdx, start)}</span>);
                    }
                    const r = refMap[key];
                    if (r) {
                      const token = mm[0];
                      parts.push(
                        <span
                          key={`c-${key}-${start}`}
                          className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 align-baseline text-xs text-gray-800 shadow-sm"
                          data-testid={testIds.chat.refs.chip(key)}
                          title={`${r.fullLabel}\n${r.insertText}`}
                        >
                          <button
                            type="button"
                            className="hover:underline"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const raw2 = r.insertText || "";
                              if (!raw2.startsWith("workbook://")) return;
                              const tail = raw2.replace("workbook://", "");
                              const segs = tail.split("/");
                              const workbookId = decodeURIComponent(segs[0] || "");
                              const filePath = segs
                                .slice(1)
                                .map((p) => {
                                  try {
                                    return decodeURIComponent(p);
                                  } catch {
                                    return p;
                                  }
                                })
                                .join("/");
                              if (!workbookId || !filePath) return;
                              openDocument({
                                workbookId,
                                path: filePath,
                                filename: filePath.split("/").pop() || filePath,
                              }).catch(() => {});
                            }}
                          >
                            {r.kind === "workbook" ? "📚" : r.kind === "folder" ? "📁" : "📄"} {r.displayLabel}
                          </button>
                          <button
                            type="button"
                            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-gray-200"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              // Remove this token instance from the input (and keep refMap entry in case used elsewhere).
                              setInput((prev) => prev.replace(token, "").replace(/\s{2,}/g, " "));
                            }}
                            aria-label={`Remove ${r.displayLabel}`}
                            data-testid={testIds.chat.refs.remove(key)}
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>,
                      );
                    } else {
                      parts.push(<span key={`u-${key}-${start}`}>@{visible}</span>);
                    }
                    lastIdx = end;
                  }
                  if (lastIdx < s.length) parts.push(<span key={`t-${lastIdx}`}>{s.slice(lastIdx)}</span>);
                  return (
                    <div
                      className="pointer-events-none whitespace-pre-wrap break-words px-2 py-1 pr-10 text-sm leading-5 text-gray-900"
                      data-testid={testIds.chat.refs.container}
                    >
                      {parts}
                    </div>
                  );
                }}
                overlayClassName="pointer-events-none"
                onEnterWhenMenuOpen={() => {}}
                onEnter={() => handleSend()}
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
          <button
                    ref={contextChipRef}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-800 hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setContextPicker((p) => ({ ...p, open: !p.open }))}
                    disabled={!window.electronAPI?.mcp?.call}
                    data-testid={testIds.chat.contextChip}
                    title={contextPicker.error ? `Context: ${contextPicker.error}` : contextPicker.activeName ? `Context: ${contextPicker.activeName}` : "No active Context"}
                  >
                    <span className="font-semibold">Context:</span>
                    <span className="max-w-[180px] truncate">
                      {contextPicker.loading ? "Loading…" : contextPicker.activeName || "No Context"}
                    </span>
                    <span className="text-gray-500">▾</span>
                  </button>

                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] disabled:opacity-50 ${
                      scopeChipMode === "context"
                        ? "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100"
                        : "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                    }`}
                    onClick={async () => {
                      const next = scopeChipMode === "context" ? "all" : "context";
                      try {
                        await window.electronAPI?.contextScope?.setMode?.(next);
                        setScopeChipMode(next);
                        window.dispatchEvent(new CustomEvent("context:scoping"));
                      } catch {
                        // ignore
                      }
                    }}
                    disabled={!window.electronAPI?.contextScope?.setMode}
                    data-testid={testIds.chat.scopeChip}
                    title={scopeChipMode === "context" ? "Scoped to active Context" : "WARNING: All workbooks (unscoped)"}
                  >
                    <span className="font-semibold">Scope:</span>
                    <span>{scopeChipMode === "context" ? "Scoped" : "All"}</span>
                  </button>
                </div>
              </div>

              {contextPicker.open &&
                contextMenuPos &&
                typeof document !== "undefined" &&
                createPortal(
                  <div
                    className="max-h-64 overflow-auto rounded border border-gray-200 bg-white shadow-lg"
                    style={{
                      position: "fixed",
                      top: contextMenuPos.top,
                      left: contextMenuPos.left,
                      width: contextMenuPos.width,
                      zIndex: 10000,
                    }}
                    data-testid={testIds.chat.contextMenu}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                      <div className="text-xs font-semibold text-gray-800">Select Context</div>
                      <button
                        type="button"
                        className="text-[11px] text-gray-600 hover:text-gray-800"
                        onClick={() => refreshContextPicker()}
                      >
                        Refresh
                      </button>
                    </div>

                    {contextPicker.quickWorkbooks.length > 0 && (
                      <div className="border-b border-gray-100 px-1 py-1">
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          Quick: Workbooks
                        </div>
                        {contextPicker.quickWorkbooks.slice(0, 10).map((wb) => {
                          const isActiveSingle =
                            Array.isArray(contextPicker.activeWorkbookIds) &&
                            contextPicker.activeWorkbookIds.length === 1 &&
                            contextPicker.activeWorkbookIds[0] === wb.id;
                          return (
                            <button
                              key={wb.id}
                              type="button"
                              className={`block w-full px-3 py-2 text-left text-xs hover:bg-gray-50 ${
                                isActiveSingle ? "bg-gray-50 font-semibold" : ""
                              }`}
                              data-testid={testIds.chat.contextQuickWorkbook(wb.id)}
                              title={`Activate ${wb.name}`}
                              onClick={() => activateQuickWorkbook(wb)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{wb.name}</span>
                                {isActiveSingle && <span className="text-[10px] text-gray-500">Active</span>}
                              </div>
                            </button>
                          );
                        })}
                        {contextPicker.quickWorkbooks.length > 10 && (
                          <div className="px-3 py-1 text-[10px] text-gray-400">
                            + {contextPicker.quickWorkbooks.length - 10} more…
                          </div>
                        )}
                      </div>
                    )}

                    {contextPicker.contexts.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500">
                        {contextPicker.loading ? "Loading…" : contextPicker.error ? `Error: ${contextPicker.error}` : "No contexts found"}
                      </div>
                    ) : (
                      contextPicker.contexts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`block w-full px-3 py-2 text-left text-xs hover:bg-gray-50 ${
                            c.id === contextPicker.activeId ? "bg-gray-50 font-semibold" : ""
                          }`}
                          data-testid={testIds.chat.contextItem(c.id)}
                          title={c.name}
                          onClick={async () => {
                            try {
                              if (!window.electronAPI?.mcp?.call) return;
                              await window.electronAPI.mcp.call("context-manager", "tools/call", {
                                name: "activate_context",
                                arguments: { context_id: c.id },
                              });
                              setContextPicker((p) => ({ ...p, open: false, activeId: c.id, activeName: c.name }));
                              window.dispatchEvent(new CustomEvent("context:changed"));
                            } catch (e) {
                              notifyError(e instanceof Error ? e.message : "Failed to activate context", "Chat");
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{c.name}</span>
                            {c.id === contextPicker.activeId && <span className="text-[10px] text-gray-500">Active</span>}
                          </div>
                        </button>
                      ))
                    )}
                    <div className="border-t border-gray-100 px-3 py-2">
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => {
                          setContextPicker((p) => ({ ...p, open: false }));
                          onJumpToContexts?.();
                        }}
                      >
                        Go to Contexts…
                      </button>
                    </div>
                  </div>,
                  document.body,
                )}

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !input.trim() || shouldShowScopedEmpty || contextStatus.loading || activeTab !== "chat"}
                className={`absolute bottom-1.5 right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  loading || !input.trim() || shouldShowScopedEmpty || contextStatus.loading || activeTab !== "chat"
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
            aria-label="Send"
                title="Send (Ctrl/Cmd+Enter)"
            data-testid={testIds.chat.send}
          >
                <SendIcon className="h-4 w-4" />
          </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
