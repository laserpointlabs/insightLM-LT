import ReactMarkdown from "react-markdown";

interface MarkdownViewerProps {
  content: string;
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  return (
    <div className="prose prose-sm h-full max-w-none overflow-auto p-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
