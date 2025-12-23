import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";

interface TextViewerProps {
  content: string;
  filename: string;
  isEditing?: boolean;
  onContentChange?: (content: string) => void;
}

export function TextViewer({
  content,
  filename,
  isEditing = false,
  onContentChange,
}: TextViewerProps) {
  const [editorContent, setEditorContent] = useState(content);

  useEffect(() => {
    setEditorContent(content);
  }, [content]);

  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      html: "html",
      css: "css",
      md: "markdown",
      markdown: "markdown",
      ps1: "powershell",
      psd1: "powershell",
      psm1: "powershell",
      sh: "shell",
      bash: "shell",
      zsh: "shell",
      bat: "batch",
      cmd: "batch",
      sql: "sql",
      cpp: "cpp",
      c: "c",
      h: "c",
      hpp: "cpp",
      java: "java",
      go: "go",
      rs: "rust",
      rb: "ruby",
      php: "php",
      r: "r",
      swift: "swift",
      kt: "kotlin",
      scala: "scala",
      clj: "clojure",
      lua: "lua",
      perl: "perl",
      pl: "perl",
      vb: "vb",
      cs: "csharp",
      fs: "fsharp",
      dart: "dart",
      vue: "vue",
      svelte: "svelte",
    };
    return languageMap[ext] || "plaintext";
  };

  const handleChange = (value: string | undefined) => {
    const newContent = value || "";
    setEditorContent(newContent);
    onContentChange?.(newContent);
  };

  return (
    <div className="h-full">
      <Editor
        height="100%"
        language={getLanguage(filename)}
        value={editorContent}
        theme="vs-light"
        onChange={handleChange}
        options={{
          readOnly: !isEditing,
          minimap: { enabled: false },
          wordWrap: "on",
        }}
      />
    </div>
  );
}
