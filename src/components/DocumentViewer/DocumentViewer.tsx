import { useState, useEffect, useCallback } from "react";
import { MarkdownViewer } from "./MarkdownViewer";
import { CSVViewer } from "./CSVViewer";
import { PDFViewer } from "./PDFViewer";
import { TextViewer } from "./TextViewer";
import { useDocumentStore } from "../../store/documentStore";

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
  const {
    hasUnsavedChanges,
    setUnsavedContent,
    clearUnsavedContent,
    updateDocumentContent,
    unsavedChanges,
    lastOpenedDocId,
  } = useDocumentStore();

  const activeDoc = documents.find((d) => d.id === activeDocId);
  const hasUnsaved = activeDocId ? hasUnsavedChanges(activeDocId) : false;

  const getFileExtension = (filename: string): string => {
    return filename.split(".").pop()?.toLowerCase() || "";
  };

  const isEditableFileType = (ext: string): boolean => {
    // Blacklist of binary/non-editable file types
    const binaryTypes = [
      // Documents
      "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp",
      // Images
      "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "tiff", "tif",
      // Archives
      "zip", "rar", "7z", "tar", "gz", "bz2",
      // Media
      "mp3", "mp4", "avi", "mov", "wmv", "flv", "webm", "ogg",
      // Executables
      "exe", "dll", "so", "dylib", "bin",
    ];

    // If no extension, assume editable (text file)
    if (!ext) return true;

    // Everything is editable except binary types
    return !binaryTypes.includes(ext.toLowerCase());
  };

  const handleSave = useCallback(async () => {
    if (!activeDocId || !activeDoc) return;

    const unsavedContent = unsavedChanges.get(activeDocId);
    const contentToSave = unsavedContent || activeDoc.content || "";

    try {
      await window.electronAPI.file.write(
        activeDoc.workbookId,
        activeDoc.path,
        contentToSave
      );
      updateDocumentContent(activeDocId, contentToSave);
      clearUnsavedContent(activeDocId);
    } catch (error) {
      console.error("Failed to save file:", error);
      alert(`Failed to save file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [activeDocId, activeDoc, unsavedChanges, updateDocumentContent, clearUnsavedContent]);

  // Handle Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeDocId && activeDoc && isEditableFileType(getFileExtension(activeDoc.filename))) {
          handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDocId, activeDoc, handleSave]);

  const handleContentChange = (newContent: string) => {
    if (activeDocId) {
      setUnsavedContent(activeDocId, newContent);
    }
  };

  // Automatically select the most recently opened document
  useEffect(() => {
    if (lastOpenedDocId && documents.some((d) => d.id === lastOpenedDocId)) {
      // Always select the last opened document, even if it's already active
      // This ensures clicking an already-open document brings it to front
      setActiveDocId(lastOpenedDocId);
    } else if (documents.length > 0 && !activeDocId) {
      // Fallback: select first document if none selected
      setActiveDocId(documents[0].id);
    }
  }, [lastOpenedDocId, documents]);

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
    const editable = isEditableFileType(ext);
    const currentContent = hasUnsaved
      ? (unsavedChanges.get(activeDocId) || activeDoc.content || "")
      : (activeDoc.content || "");

    if (ext === "md" || ext === "markdown") {
      return (
        <MarkdownViewer
          content={currentContent}
          isEditing={editable}
          onContentChange={handleContentChange}
        />
      );
    } else if (ext === "csv") {
      return (
        <CSVViewer
          content={currentContent}
          isEditing={editable}
          onContentChange={handleContentChange}
        />
      );
    } else if (ext === "pdf") {
      return (
        <PDFViewer workbookId={activeDoc.workbookId} path={activeDoc.path} />
      );
    } else {
      return (
        <TextViewer
          content={currentContent}
          filename={activeDoc.filename}
          isEditing={editable}
          onContentChange={handleContentChange}
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
              <span className="text-sm">
                {doc.filename}
                {hasUnsavedChanges(doc.id) && (
                  <span className="ml-2 text-orange-500">●</span>
                )}
              </span>
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
      {activeDoc && isEditableFileType(getFileExtension(activeDoc.filename)) && hasUnsaved && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
          <span className="text-xs text-orange-500">Unsaved changes</span>
          <button
            onClick={handleSave}
            className="ml-auto rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
          >
            Save (Ctrl+S)
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto">{renderDocument()}</div>
    </div>
  );
}
