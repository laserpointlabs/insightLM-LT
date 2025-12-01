import { useState } from "react";
import { MarkdownViewer } from "./MarkdownViewer";
import { CSVViewer } from "./CSVViewer";
import { PDFViewer } from "./PDFViewer";
import { TextViewer } from "./TextViewer";

export interface OpenDocument {
  id: string;
  workbookId: string;
  path: string;
  filename: string;
  content?: string;
}

interface DocumentViewerProps {
  documents: OpenDocument[];
  onClose: (id: string) => void;
}

export function DocumentViewer({ documents, onClose }: DocumentViewerProps) {
  const [activeDocId, setActiveDocId] = useState<string | null>(
    documents.length > 0 ? documents[0].id : null,
  );

  const activeDoc = documents.find((d) => d.id === activeDocId);

  const getFileExtension = (filename: string): string => {
    return filename.split(".").pop()?.toLowerCase() || "";
  };

  const renderDocument = () => {
    if (!activeDoc) {
      return (
        <div className="flex h-full items-center justify-center text-gray-500">
          No document selected
        </div>
      );
    }

    // Show loading state if content is empty and document was just opened
    if (!activeDoc.content && activeDoc.path && !activeDoc.content?.includes('Error loading')) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 mb-2">Loading document...</div>
            <div className="text-xs text-gray-400">{activeDoc.filename}</div>
          </div>
        </div>
      );
    }

    const ext = getFileExtension(activeDoc.filename);

    if (ext === "md" || ext === "markdown") {
      return <MarkdownViewer content={activeDoc.content || ""} />;
    } else if (ext === "csv") {
      return <CSVViewer content={activeDoc.content || ""} />;
    } else if (ext === "pdf") {
      return (
        <PDFViewer workbookId={activeDoc.workbookId} path={activeDoc.path} />
      );
    } else {
      return (
        <TextViewer
          content={activeDoc.content || ""}
          filename={activeDoc.filename}
        />
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      {documents.length > 0 && (
        <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`flex cursor-pointer items-center gap-2 border-r border-gray-200 px-4 py-2 ${
                activeDocId === doc.id
                  ? "border-b-2 border-b-blue-500 bg-white"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => setActiveDocId(doc.id)}
            >
              <span className="text-sm">{doc.filename}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(doc.id);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto">{renderDocument()}</div>
    </div>
  );
}
