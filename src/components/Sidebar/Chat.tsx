import { useState, useEffect, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { AddIcon, HistoryIcon, GearIcon } from "../Icons";
import { testIds } from "../../testing/testIds";
import { notifyError, notifySuccess } from "../../utils/notify";
import { MentionItem, MentionTextInput } from "../MentionTextInput";

type PersistedChatMessage = {
  id: string;
  seq: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
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
  }, [contextStatus.activeContextId]);

  const handleShowHistory = useCallback(() => {
    setActiveTab("history");
  }, []);

  const handleShowSettings = useCallback(() => {
    setActiveTab("settings");
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

  const loadThread = useCallback(async () => {
    const ctxId = contextStatus.activeContextId;
    if (!ctxId) {
      setMessages([]);
      return;
    }
    try {
      const res = await window.electronAPI?.chat?.getThread?.(ctxId);
      const msgs = Array.isArray(res?.messages) ? (res.messages as PersistedChatMessage[]) : [];
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
        </div>
      );
    }
  }, [onActionButton, handleNewChat, handleShowHistory, handleShowSettings]);

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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    const ctxId = contextStatus.activeContextId;
    if (!ctxId) return;

    setLoading(true);

    try {
      // Persist + render user message first (deterministic ordering via backend seq).
      const appendedUser = await window.electronAPI?.chat?.append?.({
        contextId: ctxId,
        role: "user",
        content: userMessage,
      });
      const userMsg = appendedUser?.message as PersistedChatMessage | undefined;
      if (userMsg) {
        setMessages((prev) => [...prev, userMsg].sort((a, b) => a.seq - b.seq));
      }

      const historyForLLM = [...messages, ...(userMsg ? [userMsg] : [])].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await window.electronAPI.llm.chat(historyForLLM);

      const appendedAssistant = await window.electronAPI?.chat?.append?.({
        contextId: ctxId,
        role: "assistant",
        content: response,
      });
      const assistantMsg = appendedAssistant?.message as PersistedChatMessage | undefined;
      if (assistantMsg) {
        setMessages((prev) => [...prev, assistantMsg].sort((a, b) => a.seq - b.seq));
      }
    } catch (error) {
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
      const llm = res?.llm || {};
      const provider =
        llm.provider === "claude" || llm.provider === "ollama" ? llm.provider : "openai";
      setLlmForm((p) => ({
        ...p,
        loading: false,
        provider,
        model: String(llm.model || ""),
        REDACTED || ""),
        baseUrl: String(llm.baseUrl || ""),
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
      await window.electronAPI.config.updateLLM({
        provider: llmForm.provider,
        model: llmForm.model,
        REDACTED
        baseUrl: llmForm.baseUrl,
      });
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
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
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
                    onChange={(e) =>
                      setLlmForm((p) => ({ ...p, provider: e.target.value as any }))
                    }
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
                      onChange={(e) => setLlmForm((p) => ({ ...p, model: e.target.value }))}
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
                    onChange={(e) => setLlmForm((p) => ({ ...p, model: e.target.value }))}
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
                    onChange={(e) => setLlmForm((p) => ({ ...p, REDACTED }))}
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
                    onChange={(e) => setLlmForm((p) => ({ ...p, baseUrl: e.target.value }))}
                    disabled={llmForm.loading}
                    placeholder='e.g. "http://localhost:11434"'
                    data-testid={testIds.chat.llmConfig.baseUrl}
                  />
                </label>

                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-gray-500" data-testid={testIds.chat.llmConfig.status}>
                    {llmForm.loading ? "Saving/loading…" : llmForm.error ? `Error: ${llmForm.error}` : "Saved to config/llm.yaml"}
                  </div>
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
        ) : (
          <>
            <div data-testid={testIds.chat.tabs.panelChat}>
              {messages.length === 0 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  Start a conversation about your workbooks
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  data-chat-message
                  data-role={msg.role}
                  data-testid={testIds.chat.message(msg.id || String(idx))}
                  data-chat-message-id={msg.id}
                >
                  <ChatMessage role={msg.role} content={msg.content} />
                </div>
              ))}
              {loading && <div className="text-sm text-gray-500">Thinking...</div>}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-gray-200 px-3 py-2">
        <div className="flex gap-2">
          <MentionTextInput
            value={input}
            onChange={setInput}
            disabled={loading || shouldShowScopedEmpty || contextStatus.loading || activeTab !== "chat"}
            placeholder="Ask about your workbooks… (type @ to reference)"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            inputTestId={testIds.chat.input}
            menuTestId={testIds.chat.mentions.menu}
            itemTestId={(it) => testIds.chat.mentions.item(it.kind, it.id)}
            mentionItems={mentionItems}
            onEnterWhenMenuOpen={() => {}}
            onEnter={() => handleSend()}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !input.trim() || shouldShowScopedEmpty || contextStatus.loading || activeTab !== "chat"}
            className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
            data-testid={testIds.chat.send}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
