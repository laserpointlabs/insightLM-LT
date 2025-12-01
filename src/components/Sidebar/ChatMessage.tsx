import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="ml-4 whitespace-pre-wrap rounded bg-blue-100 p-2 text-sm">
        {content}
      </div>
    );
  }

  // Render assistant messages as markdown
  return (
    <div className="mr-4 rounded bg-gray-100 p-2 text-sm">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            table: ({ children }) => (
              <div className="my-2 overflow-x-auto">
                <table className="min-w-full border border-gray-300 text-xs">
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className="border border-gray-300 bg-gray-200 px-2 py-1 text-left font-semibold">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-gray-300 px-2 py-1">{children}</td>
            ),
            code: ({ children, className }) => {
              const isInline = !className;
              return isInline ? (
                <code className="rounded bg-gray-200 px-1 text-xs">
                  {children}
                </code>
              ) : (
                <code className={className}>{children}</code>
              );
            },
            pre: ({ children }) => (
              <pre className="my-2 overflow-x-auto rounded bg-gray-800 p-2 text-xs text-gray-100">
                {children}
              </pre>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
