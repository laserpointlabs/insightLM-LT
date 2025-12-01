import { useState } from "react";
import { ChatMessage } from "./ChatMessage";

export function Chat() {
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    const newMessages = [
      ...messages,
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
    <div className="flex h-full flex-col border-t border-gray-200">
      <div className="border-b border-gray-200 p-2">
        <h2 className="text-sm font-semibold">Chat</h2>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
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

      <div className="border-t border-gray-200 p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your workbooks..."
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
