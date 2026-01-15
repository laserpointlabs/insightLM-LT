import { useEffect, useState, useRef, Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import Editor from "@monaco-editor/react";
import mermaid from "mermaid";
import { ResizablePane } from "../ResizablePane";
import { testIds } from "../../testing/testIds";

type MarkdownViewMode = "edit" | "preview" | "split";

interface MarkdownViewerProps {
  content: string;
  isEditing?: boolean;
  onContentChange?: (content: string) => void;
}

// Initialize Mermaid once
let mermaidInitialized = false;

// Component to render Mermaid diagrams
function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize mermaid only once
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
        fontFamily: "inherit",
        suppressErrorRendering: true,
      });
      mermaidInitialized = true;
    }

    const renderDiagram = async () => {
      try {
        // Clean the chart string - remove any extra whitespace
        const cleanChart = chart.trim();
        if (!cleanChart) {
          setError("Empty mermaid diagram");
          return;
        }

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, cleanChart);

        // Ensure SVG has white background by modifying the SVG string
        const svgWithWhiteBg = svg.replace(
          /<svg([^>]*)>/,
          (match, attrs) => {
            // Add or update style attribute to ensure white background
            if (attrs.includes('style=')) {
              return match.replace(/style="([^"]*)"/, (styleMatch, styleValue) => {
                const updatedStyle = styleValue.includes('background')
                  ? styleValue.replace(/background[^;]*;?/g, '').trim()
                  : styleValue;
                return `style="${updatedStyle}; background: white;"`;
              });
            } else {
              return `<svg${attrs} style="background: white;">`;
            }
          }
        );

        setSvg(svgWithWhiteBg);
        setError(null);
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        setSvg("");
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <div className="my-4 rounded border border-gray-300 bg-gray-50 p-2">
        <p className="text-xs text-gray-500 italic">⚠ Mermaid syntax error (hover for details)</p>
        <details className="mt-1">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Show error details</summary>
          <div className="mt-2 p-2 bg-white rounded border border-gray-200">
            <p className="text-xs text-red-600">{error}</p>
            <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">{chart}</pre>
          </div>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div ref={containerRef} className="my-4 text-center text-gray-400 text-sm bg-white rounded-lg p-4 border border-gray-200">
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center bg-white rounded-lg p-4 border border-gray-200"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const MARKDOWN_SPLIT_STORAGE_KEY = "insightlm-markdown-split";
const DEFAULT_SPLIT_PERCENT = 50; // Percentage

function loadSplitPercent(): number {
  try {
    const stored = localStorage.getItem(MARKDOWN_SPLIT_STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load markdown split percent:", e);
  }
  return DEFAULT_SPLIT_PERCENT;
}

function saveSplitPercent(percent: number) {
  try {
    localStorage.setItem(MARKDOWN_SPLIT_STORAGE_KEY, percent.toString());
  } catch (e) {
    console.error("Failed to save markdown split percent:", e);
  }
}

export function MarkdownViewer({
  content,
  isEditing = false,
  onContentChange,
}: MarkdownViewerProps) {
  const [editorContent, setEditorContent] = useState(content);
  const [viewMode, setViewMode] = useState<MarkdownViewMode>("split");
  const [splitPercent, setSplitPercent] = useState(loadSplitPercent);
  const [editorWidthPixels, setEditorWidthPixels] = useState(400); // Default fallback
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [mathRendered, setMathRendered] = useState<boolean>(false);

  useEffect(() => {
    setEditorContent(content);
  }, [content]);

  // Best-effort detection so automation can assert math rendering without relying on class selectors.
  useEffect(() => {
    try {
      const el = previewRef.current;
      if (!el) return;
      const hasKatex = !!el.querySelector(".katex");
      setMathRendered(hasKatex);
    } catch {
      setMathRendered(false);
    }
  }, [editorContent, viewMode, isEditing]);

  useEffect(() => {
    // When editing is enabled, default to split view; when disabled, show preview only
    if (isEditing) {
      setViewMode("split");
    } else {
      setViewMode("preview");
    }
  }, [isEditing]);

  // Update pixel width when container is mounted or resized
  useEffect(() => {
    if (!containerRef.current || viewMode !== "split") return;

    const updateWidth = () => {
      if (containerRef.current) {
        const width = (containerRef.current.offsetWidth * splitPercent) / 100;
        setEditorWidthPixels(width);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [splitPercent, viewMode]);

  const handleChange = (value: string | undefined) => {
    const newContent = value || "";
    setEditorContent(newContent);
    onContentChange?.(newContent);
  };

  const handleSplitResize = (pixels: number) => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const percent = (pixels / containerWidth) * 100;
    const clampedPercent = Math.max(20, Math.min(80, percent));
    setSplitPercent(clampedPercent);
    saveSplitPercent(clampedPercent);
  };

  const renderPreview = () => (
    <div
      ref={previewRef}
      className="h-full overflow-auto bg-white p-4"
      data-testid={testIds.markdown.preview}
      data-math-rendered={mathRendered ? "true" : "false"}
    >
      {editorContent.trim() === "" ? (
        <div className="text-sm text-gray-400 italic">Empty document</div>
      ) : (
        <ReactMarkdown
          className="prose prose-sm max-w-none"
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code({ inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const language = match ? match[1] : "";

              // Properly extract code string from children (which can be an array)
              const codeString = Array.isArray(children)
                ? children.map(child => (typeof child === 'string' ? child : String(child))).join('')
                : String(children);
              const trimmedCode = codeString.replace(/\n$/, "");

              // Handle Mermaid diagrams
              if (!inline && language === "mermaid") {
                return <MermaidDiagram chart={trimmedCode} />;
              }

              // Inline code
              if (inline) {
                return (
                  <code className="not-prose rounded bg-gray-200 px-1.5 py-0.5 text-sm font-mono" {...props}>
                    {children}
                  </code>
                );
              }

              // Block code
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            pre({ children, ...props }) {
              // Check if this pre contains a mermaid diagram
              // ReactMarkdown wraps code blocks in pre, and when we return MermaidDiagram
              // from the code component, it replaces the code but pre wrapper remains
              let hasMermaid = false;

              Children.forEach(children, (child) => {
                if (isValidElement(child)) {
                  const className = child.props?.className;
                  // MermaidDiagram renders a div with bg-white rounded-lg classes
                  if (className && typeof className === 'string') {
                    if (className.includes('bg-white') && className.includes('rounded-lg')) {
                      hasMermaid = true;
                    }
                    // Also check for code element with language-mermaid (before MermaidDiagram replacement)
                    if (className.includes('language-mermaid')) {
                      hasMermaid = true;
                    }
                  }
                  // Check if child has dangerouslySetInnerHTML (MermaidDiagram uses this)
                  if (child.props?.dangerouslySetInnerHTML) {
                    hasMermaid = true;
                  }
                }
              });

              // If it's a mermaid diagram, render without the black background wrapper
              if (hasMermaid) {
                return <div className="my-4">{children}</div>;
              }

              // Regular code block styling
              return (
                <pre className="not-prose my-4 overflow-x-auto rounded bg-gray-800 p-4 text-sm text-gray-100" {...props}>
                  {children}
                </pre>
              );
            },
          }}
        >
          {editorContent}
        </ReactMarkdown>
      )}
    </div>
  );

  const renderEditor = () => (
    <div className="h-full">
      <Editor
        height="100%"
        language="markdown"
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

  // If not editing, show preview only
  if (!isEditing) {
    return renderPreview();
  }

  // View mode controls
  const viewModeButtons = (
    <div className="absolute top-2 right-2 z-20 flex gap-1 rounded bg-white shadow-md border border-gray-200">
      <button
        onClick={() => setViewMode("edit")}
        className={`px-3 py-1 text-xs font-medium transition-colors ${
          viewMode === "edit"
            ? "bg-blue-500 text-white"
            : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
        title="Edit only"
      >
        Edit
      </button>
      <button
        onClick={() => setViewMode("split")}
        className={`px-3 py-1 text-xs font-medium transition-colors ${
          viewMode === "split"
            ? "bg-blue-500 text-white"
            : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
        title="Split view"
      >
        Split
      </button>
      <button
        onClick={() => setViewMode("preview")}
        className={`px-3 py-1 text-xs font-medium transition-colors ${
          viewMode === "preview"
            ? "bg-blue-500 text-white"
            : "bg-white text-gray-700 hover:bg-gray-100"
        }`}
        title="Preview only"
      >
        Preview
      </button>
    </div>
  );

  // Edit only mode
  if (viewMode === "edit") {
    return (
      <div className="relative h-full">
        {viewModeButtons}
        {renderEditor()}
      </div>
    );
  }

  // Preview only mode
  if (viewMode === "preview") {
    return (
      <div className="relative h-full">
        {viewModeButtons}
        {renderPreview()}
      </div>
    );
  }

  // Split view mode
  const editorWidthPercent = splitPercent;
  const previewWidthPercent = 100 - splitPercent;

  return (
    <div ref={containerRef} className="relative flex h-full">
      {viewModeButtons}
      {/* Editor pane */}
      <div style={{ width: `${editorWidthPercent}%` }} className="flex-shrink-0">
        {renderEditor()}
      </div>

      {/* Resizable separator */}
      <ResizablePane
        direction="horizontal"
        onResize={handleSplitResize}
        initialSize={editorWidthPixels}
        minSize={containerRef.current ? (containerRef.current.offsetWidth * 0.2) : 200}
        maxSize={containerRef.current ? (containerRef.current.offsetWidth * 0.8) : 800}
      />

      {/* Preview pane */}
      <div style={{ width: `${previewWidthPercent}%` }} className="flex-shrink-0">
        {renderPreview()}
      </div>
    </div>
  );
}
