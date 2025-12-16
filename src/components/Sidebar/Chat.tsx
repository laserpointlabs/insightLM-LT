import { useState, useEffect, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { AddIcon, HistoryIcon, GearIcon } from "../Icons";
import { testIds } from "../../testing/testIds";

interface ChatProps {
  onActionButton?: (button: React.ReactNode) => void;
}

export function Chat({ onActionButton }: ChatProps = {}) {
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
  }, []);

  const handleShowHistory = useCallback(() => {
    // TODO: Implement chat history view
    console.log("Show chat history");
  }, []);

  const handleShowSettings = useCallback(() => {
    // TODO: Implement chat settings
    console.log("Show chat settings");
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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    // Lightweight command handler (no LLM call)
    if (userMessage.startsWith("/context")) {
      const parts = userMessage.split(/\s+/).filter(Boolean);
      const sub = parts[1] || "help";
      const rest = parts.slice(2).join(" ");

      setMessages((prev) => [...prev, { role: "user" as const, content: userMessage }]);
      setLoading(true);

      try {
        if (!window.electronAPI?.mcp?.call) {
          throw new Error("MCP API not available");
        }

        if (sub === "list") {
          const res = await window.electronAPI.mcp.call("context-manager", "tools/call", {
            name: "list_contexts",
            arguments: {},
          });
          const contexts = res?.contexts || [];
          const lines = contexts.map((c: any) => `- ${c.name} (${c.id})`).join("\n");
          setMessages((prev) => [
            ...prev,
            { role: "assistant" as const, content: contexts.length ? `Contexts:\n${lines}` : "No contexts found." },
          ]);
        } else if (sub === "active") {
          const res = await window.electronAPI.mcp.call("context-manager", "tools/call", {
            name: "get_active_context",
            arguments: {},
          });
          const active = res?.active;
          setMessages((prev) => [
            ...prev,
            { role: "assistant" as const, content: active ? `Active context: ${active.name} (${active.id})` : "No active context." },
          ]);
        } else if (sub === "activate") {
          if (!rest.trim()) {
            throw new Error('Usage: /context activate "<nameOrId>"');
          }
          const list = await window.electronAPI.mcp.call("context-manager", "tools/call", {
            name: "list_contexts",
            arguments: {},
          });
          const contexts = list?.contexts || [];
          const needle = rest.trim().replace(/^"(.*)"$/, "$1");
          const match =
            contexts.find((c: any) => c.id === needle) ||
            contexts.find((c: any) => (c.name || "").toLowerCase() === needle.toLowerCase()) ||
            contexts.find((c: any) => (c.name || "").toLowerCase().includes(needle.toLowerCase()));

          if (!match) {
            throw new Error(`No context found matching "${needle}". Try /context list`);
          }

          await window.electronAPI.mcp.call("context-manager", "tools/call", {
            name: "activate_context",
            arguments: { context_id: match.id },
          });
          window.dispatchEvent(new CustomEvent("context:changed"));
          setMessages((prev) => [
            ...prev,
            { role: "assistant" as const, content: `Activated context: ${match.name} (${match.id})` },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant" as const,
              content:
                `Context commands:\n` +
                `- /context list\n` +
                `- /context active\n` +
                `- /context activate <nameOrId>`,
            },
          ]);
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant" as const,
            content: `Error: ${error instanceof Error ? error.message : "Command failed"}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Filter out any tool or system messages - only send user and assistant messages
    const cleanedMessages = messages.filter(
      msg => msg.role === "user" || msg.role === "assistant"
    );

    const newMessages = [
      ...cleanedMessages,
      { role: "user" as const, content: userMessage },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await window.electronAPI.llm.chat(newMessages);
      setMessages([
        ...newMessages,
        { role: "assistant" as const, content: response },
      ]);
    } catch (error) {
      setMessages([
        ...newMessages,
        {
          role: "assistant" as const,
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Start a conversation about your workbooks
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} data-chat-message data-role={msg.role}>
            <ChatMessage role={msg.role} content={msg.content} />
          </div>
        ))}
        {loading && <div className="text-sm text-gray-500">Thinking...</div>}
      </div>

      <div className="border-t border-gray-200 px-3 py-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your workbooks..."
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={loading}
            data-testid={testIds.chat.input}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send"
            data-testid={testIds.chat.send}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
