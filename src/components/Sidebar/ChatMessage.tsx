import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDocumentStore } from "../../store/documentStore";
import { notifyError } from "../../utils/notify";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const { openDocument } = useDocumentStore();

  // Replace workbook:// links with a special marker before ReactMarkdown processes them
  // This prevents ReactMarkdown from creating <a> tags that Electron intercepts
  const processedContent = React.useMemo(() => {
    if (role !== "assistant") return content;

    // Replace workbook:// links with a special format that we'll handle manually
    return content.replace(/\[([^\]]+)\]\(workbook:\/\/([^\)]+)\)/g, (_match, linkText, workbookPath) => {
      // Store the workbook path in a data attribute format we can parse
      return `[${linkText}](__workbook_link__${workbookPath}__)`;
    });
  }, [content, role]);

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
    </div>
  );
}
