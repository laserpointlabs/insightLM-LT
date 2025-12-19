import { useState, useEffect, useCallback } from "react";
import { MarkdownViewer } from "./MarkdownViewer";
import { CSVViewer } from "./CSVViewer";
import { PDFViewer } from "./PDFViewer";
import { TextViewer } from "./TextViewer";
import { DashboardViewer } from "./DashboardViewer";
import { useDocumentStore } from "../../store/documentStore";
import { extensionRegistry } from "../../services/extensionRegistry";
import { notifyError, notifySuccess } from "../../utils/notify";

// Component to handle async component loading
function AsyncComponentLoader({ componentPromise, props }: { componentPromise: Promise<any>, props: any }) {
  const [Component, setComponent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    componentPromise
      .then((LoadedComponent) => {
        console.log('AsyncComponentLoader: Component loaded successfully');
        setComponent(() => LoadedComponent);
      })
      .catch((err) => {
        console.error('AsyncComponentLoader: Failed to load component:', err);
        setError(err.message);
      });
  }, [componentPromise]);

  if (error) {
    return <div className="p-4 text-red-500">Error loading component: {error}</div>;
  }

  if (!Component) {
    return <div className="p-4 text-gray-500">Loading component...</div>;
  }

  return <Component {...props} />;
}

export interface OpenDocument {
  id: string;
  workbookId?: string; // Optional for dashboards
  path?: string; // Optional for dashboards
  filename: string;
  content?: string;
  type?: "document" | "dashboard" | "config"; // Document type
  dashboardId?: string; // For dashboard documents
  configKey?: "llm"; // For config documents
}

interface DocumentViewerProps {
  documents: OpenDocument[];
  onClose: (id: string) => void;
}

export function DocumentViewer({ documents, onClose }: DocumentViewerProps) {
  const [activeDocId, setActiveDocId] = useState<string | null>(
    documents.length > 0 ? documents[0].id : null,
  );
  const [, forceExtensionUpdate] = useState(0);
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
    if (!activeDocId || !activeDoc || activeDoc.type === "dashboard") return;

    const unsavedContent = unsavedChanges.get(activeDocId);
    const contentToSave = unsavedContent || activeDoc.content || "";

    try {
      if (activeDoc.type === "config" && activeDoc.configKey === "llm") {
        if (!window.electronAPI?.config?.saveLLMRaw) throw new Error("Config API not available");
        await window.electronAPI.config.saveLLMRaw(contentToSave);
      } else {
        if (!activeDoc.workbookId || !activeDoc.path) return;
        await window.electronAPI.file.write(
          activeDoc.workbookId,
          activeDoc.path,
          contentToSave
        );
      }
      updateDocumentContent(activeDocId, contentToSave);
      clearUnsavedContent(activeDocId);
      notifySuccess("Saved", activeDoc.filename);
    } catch (error) {
      console.error("Failed to save file:", error);
      notifyError(error instanceof Error ? error.message : "Failed to save file", activeDoc.filename);
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

  useEffect(() => {
    const unsubscribe = extensionRegistry.subscribe(() => {
      forceExtensionUpdate((v) => v + 1);
    });
    return unsubscribe;
  }, []);

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

    // Handle dashboard documents
    if (activeDoc.type === "dashboard" && activeDoc.dashboardId) {
      return <DashboardViewer dashboardId={activeDoc.dashboardId} />;
    }

    // Show loading state if content is undefined (not loaded yet) vs empty string (loaded but empty)
    if (activeDoc.content === undefined && activeDoc.path) {
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
      ? (unsavedChanges.get(activeDocId) ?? activeDoc.content ?? "")
      : (activeDoc.content ?? "");

    // Check for extension file handlers first
    const fileHandlers = extensionRegistry.getFileHandlers(ext);
    console.log(`DocumentViewer: Looking for handlers for extension "${ext}", found ${fileHandlers.length} handlers`);
    console.log(`DocumentViewer: Current filename: ${activeDoc.filename}, full path: ${activeDoc.path}`);
    if (fileHandlers.length > 0) {
      // Use the first (highest priority) file handler
      const handler = fileHandlers[0];
      console.log(`DocumentViewer: Using handler for ${ext}`, handler);
      try {
        // Handle async component loading
        const ComponentPromise = handler.component();
        if (ComponentPromise instanceof Promise) {
          // Async component - render a loading state while it loads
          console.log(`DocumentViewer: Loading async component for ${ext}`);
          return <AsyncComponentLoader
            componentPromise={ComponentPromise}
            props={{
              content: currentContent,
              filename: activeDoc.filename,
              workbookId: activeDoc.workbookId,
              path: activeDoc.path,
              onContentChange: handleContentChange
            }}
          />;
        } else {
          // Sync component
          console.log(`DocumentViewer: Rendering sync component for ${ext}`);
          return (
            <ComponentPromise
              content={currentContent}
              filename={activeDoc.filename}
              workbookId={activeDoc.workbookId}
              path={activeDoc.path}
              onContentChange={handleContentChange}
            />
          );
        }
      } catch (error) {
        console.error(`DocumentViewer: Error rendering component for ${ext}:`, error);
        // Fall back to default viewer
      }
    } else {
      console.log(`DocumentViewer: No handlers found for ${ext}, using default viewer`);
    }

    // Fall back to built-in viewers
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
      {activeDoc && activeDoc.type !== "dashboard" && isEditableFileType(getFileExtension(activeDoc.filename)) && hasUnsaved && (
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
