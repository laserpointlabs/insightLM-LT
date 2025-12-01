import { useState } from "react";

interface PDFViewerProps {
  workbookId: string;
  path: string;
}

export function PDFViewer({ workbookId, path }: PDFViewerProps) {
  const [error, setError] = useState<string | null>(null);

  // For now, show a placeholder
  // PDF viewing will require additional setup with react-pdf
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-center">
        <p className="mb-2 text-gray-500">PDF Viewer</p>
        <p className="text-sm text-gray-400">
          PDF viewing will be implemented with react-pdf library
        </p>
        <p className="mt-2 text-xs text-gray-400">File: {path}</p>
      </div>
    </div>
  );
}
