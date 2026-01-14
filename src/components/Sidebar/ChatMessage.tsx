import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { useDocumentStore } from "../../store/documentStore";
import { notifyError } from "../../utils/notify";
import { testIds } from "../../testing/testIds";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  meta?: {
    thinking?: {
      durationMs?: number;
      provider?: string;
      model?: string;
      requestId?: string;
    };
  };
}

// Initialize Mermaid once (module-level)
let mermaidInitialized = false;

function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [svg, setSvg] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
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
        const cleanChart = chart.trim();
        if (!cleanChart) {
          setError("Empty mermaid diagram");
          return;
        }

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, cleanChart);

        // Ensure SVG has a white background (same approach as MarkdownViewer)
        const svgWithWhiteBg = svg.replace(/<svg([^>]*)>/, (match, attrs) => {
          if (attrs.includes('style=')) {
            return match.replace(/style="([^"]*)"/, (_styleMatch, styleValue) => {
              const updatedStyle = styleValue.includes("background")
                ? styleValue.replace(/background[^;]*;?/g, "").trim()
                : styleValue;
              return `style="${updatedStyle}; background: white;"`;
            });
          }
          return `<svg${attrs} style="background: white;">`;
        });

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
      <div className="my-2 rounded border border-gray-300 bg-gray-50 p-2">
        <p className="text-xs text-gray-500 italic">⚠ Mermaid syntax error (hover for details)</p>
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">Show error details</summary>
          <div className="mt-2 rounded border border-gray-200 bg-white p-2">
            <p className="text-xs text-red-600">{error}</p>
            <pre className="mt-2 overflow-x-auto text-xs text-gray-600">{chart}</pre>
          </div>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        ref={containerRef}
        className="my-2 rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-400"
      >
        Loading diagram...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-2 flex justify-center rounded-lg border border-gray-200 bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function ChatMessage({ role, content, meta }: ChatMessageProps) {
  const { openDocument } = useDocumentStore();

  const thinking = meta?.thinking;
  const [thinkingOpen, setThinkingOpen] = React.useState(false);
  const thinkingLabel = React.useMemo(() => {
    if (!thinking) return null;
    const durMs = typeof thinking.durationMs === "number" ? thinking.durationMs : null;
    if (durMs === null) return "Thought for…";
    const s = Math.max(0, durMs) / 1000;
    return `Thought for ${s.toFixed(s < 10 ? 1 : 0)}s`;
  }, [thinking]);

  const { bodyContent, sources } = React.useMemo(() => {
    if (role !== "assistant") return { bodyContent: content, sources: [] as Array<{ workbookId: string; filePath: string; label: string }> };

    const raw = String(content || "");
    const marker = "\n\n---\n\n**Sources:**\n\n";
    const idx = raw.lastIndexOf(marker);
    if (idx < 0) return { bodyContent: raw, sources: [] as Array<{ workbookId: string; filePath: string; label: string }> };

    const body = raw.slice(0, idx).trimEnd();
    const srcPart = raw.slice(idx + marker.length);

    const out: Array<{ workbookId: string; filePath: string; label: string }> = [];
    const seen = new Set<string>();
    const re = /\[([^\]]+)\]\(workbook:\/\/([^\s/]+)\/([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(srcPart)) !== null) {
      const label = String(m[1] || "").trim();
      const workbookId = String(m[2] || "").trim();
      const encodedPath = String(m[3] || "").trim().replace(/[)\],.]+$/g, "");
      if (!workbookId || !encodedPath) continue;
      const filePath = encodedPath
        .split("/")
        .map((p) => {
          try {
            return decodeURIComponent(p);
          } catch {
            return p;
          }
        })
        .join("/");
      const key = `${workbookId}::${filePath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ workbookId, filePath, label: label || (filePath.split("/").pop() || filePath) });
    }
    return { bodyContent: body, sources: out };
  }, [content, role]);

  // Replace workbook:// links with a special marker before ReactMarkdown processes them
  // This prevents ReactMarkdown from creating <a> tags that Electron intercepts
  const processedContent = React.useMemo(() => {
    if (role !== "assistant") return content;

    // Replace workbook:// links with a special format that we'll handle manually
    return String(bodyContent || "").replace(/\[([^\]]+)\]\(workbook:\/\/([^\)]+)\)/g, (_match, linkText, workbookPath) => {
      // Store the workbook path in a data attribute format we can parse
      return `[${linkText}](__workbook_link__${workbookPath}__)`;
    });
  }, [bodyContent, role]);

  // Global click handler to catch any workbook:// links that might slip through
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check for our special marker links
      const link = target.closest('a[href^="__workbook_link__"]');
      if (link) {
        const href = link.getAttribute('href');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (href) {
          const workbookPath = href.replace('__workbook_link__', '').replace('__', '');
          const urlParts = workbookPath.split('/');
          const workbookId = decodeURIComponent(urlParts[0]);
          const filePath = urlParts.slice(1).map(part => decodeURIComponent(part)).join('/');

          openDocument({
            workbookId,
            path: filePath,
            filename: filePath.split('/').pop() || filePath,
          }).catch((error) => {
            notifyError(error instanceof Error ? error.message : "Failed to open document", "Chat");
          });
        }

        return false;
      }

      // Also check for actual workbook:// links (fallback)
      const workbookLink = target.closest('a[href^="workbook://"]');
      if (workbookLink) {
        const href = workbookLink.getAttribute('href');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (href) {
          const urlParts = href.replace('workbook://', '').split('/');
          const workbookId = decodeURIComponent(urlParts[0]);
          const filePath = urlParts.slice(1).map(part => decodeURIComponent(part)).join('/');

          openDocument({
            workbookId,
            path: filePath,
            filename: filePath.split('/').pop() || filePath,
          }).catch((error) => {
            notifyError(error instanceof Error ? error.message : "Failed to open document", "Chat");
          });
        }

        return false;
      }
    };

    // Use capture phase to catch before anything else
    document.addEventListener('click', handleGlobalClick, true);

    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [openDocument]);


  if (role === "user") {
    return (
      <div className="whitespace-pre-wrap rounded-xl bg-blue-600 px-3 py-2 text-sm text-white shadow-sm">
        {content}
      </div>
    );
  }

  // Render assistant messages as markdown
  return (
    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-900 shadow-sm">
      {thinking && (
        <div className="mb-2">
          <div
            className="rounded-lg border border-gray-200 bg-white px-2 py-1"
            data-testid={testIds.chat.thinking.container}
            data-open={thinkingOpen ? "true" : "false"}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left text-[11px] text-gray-600"
              onClick={() => setThinkingOpen((v) => !v)}
              data-testid={testIds.chat.thinking.toggle}
              aria-expanded={thinkingOpen ? "true" : "false"}
            >
              <span className="font-semibold" data-testid={testIds.chat.thinking.summary}>
                {thinkingLabel}
              </span>
              <span className="text-gray-500">{thinkingOpen ? "Hide" : "Show"}</span>
            </button>
            {thinkingOpen && (
              <div className="mt-1 text-[11px] text-gray-600" data-testid={testIds.chat.thinking.details}>
                {(thinking.provider || thinking.model) && (
                  <div className="truncate">
                    <span className="text-gray-500">LLM:</span>{" "}
                    <span className="font-medium">{`${thinking.provider || ""}${thinking.model ? ` ${thinking.model}` : ""}`.trim()}</span>
                  </div>
                )}
                {thinking.requestId && (
                  <div className="truncate">
                    <span className="text-gray-500">Request:</span> {thinking.requestId}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="prose prose-sm max-w-none [&_small]:not-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              // Handle our special marker format
              if (href?.startsWith('__workbook_link__')) {
                const workbookPath = href.replace('__workbook_link__', '').replace('__', '');
                const urlParts = workbookPath.split('/');
                const workbookId = decodeURIComponent(urlParts[0]);
                const filePath = urlParts.slice(1).map(part => decodeURIComponent(part)).join('/');

                const handleClick = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();

                  openDocument({
                    workbookId,
                    path: filePath,
                    filename: filePath.split('/').pop() || filePath,
                  })
                  .catch((error) => {
                    notifyError(
                      error instanceof Error ? error.message : "Failed to open document",
                      "Chat",
                    );
                  });
                };

                // Check if this is in a sources section (contains emoji)
                const isInSources = String(children).includes('📄');
                const childrenStr = String(children);
                const textPart = childrenStr.replace(/📄\s*/, '').trim();

                return (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`${isInSources ? 'text-[10px] text-gray-600 hover:text-gray-800 leading-tight' : 'text-blue-600 hover:text-blue-800 underline'} cursor-pointer font-normal inline-flex items-center gap-1`}
                    onClick={handleClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(e as any);
                      }
                    }}
                  >
                    {isInSources ? (
                      <>
                        <span className="no-underline">📄</span>
                        <span className="underline">{textPart}</span>
                      </>
                    ) : (
                      children
                    )}
                  </span>
                );
              }

              if (href?.startsWith('workbook://')) {
                // Parse workbook://workbookId/path
                const urlParts = href.replace('workbook://', '').split('/');
                const workbookId = decodeURIComponent(urlParts[0]);
                const filePath = urlParts.slice(1).map(part => decodeURIComponent(part)).join('/');

                const handleClick = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();

                  // Match exactly how WorkbooksView opens documents
                  openDocument({
                    workbookId,
                    path: filePath,
                    filename: filePath.split('/').pop() || filePath,
                  })
                  .catch((error) => {
                    notifyError(
                      error instanceof Error ? error.message : "Failed to open document",
                      "Chat",
                    );
                  });
                };

                // Check if this is in a sources section (contains emoji)
                const isInSources = String(children).includes('📄');
                const childrenStr = String(children);
                const textPart = childrenStr.replace(/📄\s*/, '').trim();

                return (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`${isInSources ? 'text-[10px] text-gray-600 hover:text-gray-800 leading-tight' : 'text-blue-600 hover:text-blue-800 underline'} cursor-pointer font-normal inline-flex items-center gap-1`}
                    onClick={handleClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(e as any);
                      }
                    }}
                  >
                    {isInSources ? (
                      <>
                        <span className="no-underline">📄</span>
                        <span className="underline">{textPart}</span>
                      </>
                    ) : (
                      children
                    )}
                  </span>
                );
              }

              return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
            },
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
            code: ({ inline, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || "");
              const language = match ? match[1] : "";

              const codeString = Array.isArray(children)
                ? children.map((c) => (typeof c === "string" ? c : String(c))).join("")
                : String(children);
              const trimmedCode = codeString.replace(/\n$/, "");

              if (!inline && language === "mermaid") {
                return <MermaidDiagram chart={trimmedCode} />;
              }

              const isInline = inline || !className;
              return isInline ? (
                <code className="rounded bg-gray-200 px-1 text-xs" {...props}>
                  {children}
                </code>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            pre: ({ children, ...props }) => {
              // If this pre wraps a mermaid diagram, don't use the dark code block chrome.
              let hasMermaid = false;
              React.Children.forEach(children, (child) => {
                if (!React.isValidElement(child)) return;
                const cn = child.props?.className;
                if (typeof cn === "string") {
                  if (cn.includes("language-mermaid")) hasMermaid = true;
                  if (cn.includes("bg-white") && cn.includes("rounded-lg")) hasMermaid = true;
                }
                if (child.props?.dangerouslySetInnerHTML) hasMermaid = true;
              });

              if (hasMermaid) {
                return (
                  <div className="my-2" {...props}>
                    {children}
                  </div>
                );
              }

              return (
                <pre className="my-2 overflow-x-auto rounded bg-gray-800 p-2 text-xs text-gray-100" {...props}>
                  {children}
                </pre>
              );
            },
            hr: () => (
              <hr className="my-1 border-t border-gray-300" />
            ),
            p: ({ children, ...props }) => {
              // Check if this paragraph contains sources (workbook links)
              const childrenStr = String(children);
              const hasSources = childrenStr.includes('workbook://') || childrenStr.includes('__workbook_link__');
              const isSourcesHeader = childrenStr.includes('**Sources:**');

              if (isSourcesHeader) {
                return (
                  <p className="text-[9px] text-gray-600 font-semibold mt-0.5 mb-0 leading-[1.2]" {...props}>
                    {children}
                  </p>
                );
              }

              if (hasSources) {
                return (
                  <p className="text-[9px] text-gray-600 mt-0 mb-0 leading-[1.2]" {...props}>
                    {children}
                  </p>
                );
              }

              return <p {...props}>{children}</p>;
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>

      {sources.length > 0 && (
        <div
          className="mt-3 rounded-lg border border-gray-200 bg-white px-2 py-1"
          data-testid={testIds.chat.sources.container}
        >
          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-600">
            <span className="font-semibold">Sources</span>
            <span className="text-gray-400">{sources.length}</span>
          </div>
          <div className="mt-1 space-y-1">
            {sources.map((s) => {
              const key = `${s.workbookId}::${s.filePath}`;
              const filename = s.filePath.split("/").pop() || s.filePath;
              return (
                <button
                  key={key}
                  type="button"
                  className="flex w-full items-center gap-2 truncate rounded px-1 py-0.5 text-left text-[11px] text-gray-700 hover:bg-gray-50"
                  title={`${filename}\n${s.filePath}\n${s.workbookId}`}
                  data-testid={testIds.chat.sources.item(key)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    openDocument({
                      workbookId: s.workbookId,
                      path: s.filePath,
                      filename,
                    }).catch((error) => {
                      notifyError(error instanceof Error ? error.message : "Failed to open document", "Chat");
                    });
                  }}
                >
                  <span className="text-gray-400">📄</span>
                  <span className="truncate">{s.label || filename}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
