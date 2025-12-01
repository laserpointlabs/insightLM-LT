import Editor from "@monaco-editor/react";

interface TextViewerProps {
  content: string;
  filename: string;
}

export function TextViewer({ content, filename }: TextViewerProps) {
  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const languageMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      html: "html",
      css: "css",
      md: "markdown",
    };
    return languageMap[ext] || "plaintext";
  };

  return (
    <div className="h-full">
      <Editor
        height="100%"
        language={getLanguage(filename)}
        value={content}
        theme="vs-light"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          wordWrap: "on",
        }}
      />
    </div>
  );
}
