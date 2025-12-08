import { useState, useEffect, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { AddIcon, HistoryIcon, GearIcon } from "../Icons";

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
          >
            <AddIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleShowHistory}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Chat History"
          >
            <HistoryIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleShowSettings}
            className="flex items-center justify-center rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            title="Chat Settings"
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
          <ChatMessage key={idx} role={msg.role} content={msg.content} />
        ))}
        {loading && <div className="text-sm text-gray-500">Thinking...</div>}
      </div>

      <div className="border-t border-gray-200 px-3 py-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your workbooks..."
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
