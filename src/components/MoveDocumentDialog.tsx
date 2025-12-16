import { useEffect, useMemo, useState } from "react";

type WorkbookInfo = {
  id: string;
  name: string;
  archived?: boolean;
  folders?: string[] | null;
  documents?: Array<{ path?: string; filename?: string }> | null;
};

export interface MoveDocumentDialogProps {
  isOpen: boolean;
  workbooks: WorkbookInfo[];
  sourceWorkbookId: string;
  sourceRelativePath: string;
  sourceFilename: string;
  onCancel: () => void;
  onConfirm: (args: { targetWorkbookId: string; targetFolder?: string; targetFilename: string }) => void;
}

function toPosix(p: string) {
  return String(p || "").replace(/\\/g, "/");
}

export function MoveDocumentDialog({
  isOpen,
  workbooks,
  sourceWorkbookId,
  sourceRelativePath,
  sourceFilename,
  onCancel,
  onConfirm,
}: MoveDocumentDialogProps) {
  const candidates = useMemo(
    () => (Array.isArray(workbooks) ? workbooks.filter((w) => !w.archived) : []),
    [workbooks],
  );

  const [targetWorkbookId, setTargetWorkbookId] = useState<string>("");
  const [targetFolder, setTargetFolder] = useState<string>(""); // "" => root
  const [targetFilename, setTargetFilename] = useState<string>(sourceFilename);

  useEffect(() => {
    if (!isOpen) return;
    setTargetWorkbookId(sourceWorkbookId || candidates[0]?.id || "");

    const m = toPosix(sourceRelativePath).match(/^documents\/([^/]+)\//);
    const currentFolder = m ? m[1] : "";
    setTargetFolder(currentFolder);
    setTargetFilename(sourceFilename);
  }, [isOpen, sourceWorkbookId, candidates, sourceRelativePath, sourceFilename]);

  const selected = candidates.find((w) => w.id === targetWorkbookId);
  const folderNames = Array.isArray(selected?.folders) ? selected!.folders! : [];

  const workbookTrim = (targetWorkbookId || "").trim();
  const folderTrim = (targetFolder || "").trim();
  const filenameTrim = (targetFilename || "").trim();

  const currentFolderMatch = toPosix(sourceRelativePath).match(/^documents\/([^/]+)\//);
  const currentFolder = currentFolderMatch ? currentFolderMatch[1] : "";
  const sameWorkbook = workbookTrim === sourceWorkbookId;
  const sameFolder = (folderTrim || "") === (currentFolder || "");
  const sameName = filenameTrim === sourceFilename;
  const isNoop = sameWorkbook && sameFolder && sameName;

  const destRel = folderTrim
    ? `documents/${folderTrim}/${filenameTrim}`
    : `documents/${filenameTrim}`;

  const existingDocs = Array.isArray(selected?.documents) ? selected!.documents! : [];
  // Ignore "conflict" with the source document itself (noop move).
  const destNorm = toPosix(destRel);
  const sourceNorm = toPosix(sourceRelativePath);
  const isSameExactPath = sameWorkbook && destNorm === sourceNorm;
  const conflict = !isSameExactPath && existingDocs.some((d) => toPosix(String(d?.path || "")) === destNorm);

  const canSubmit = !!workbookTrim && !!filenameTrim && !isNoop && !conflict;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50"
        onClick={onCancel}
        data-testid="move-doc-dialog-backdrop"
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        data-testid="move-doc-dialog"
      >
        <div className="mb-3">
          <h3 className="text-lg font-semibold" data-testid="move-doc-title">
            Move Document
          </h3>
          <div className="mt-1 text-xs text-gray-500">
            Moving: <span className="font-mono">{toPosix(sourceRelativePath)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-sm font-medium text-gray-700">Target workbook</div>
            <select
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={targetWorkbookId}
              onChange={(e) => setTargetWorkbookId(e.target.value)}
              data-testid="move-doc-workbook-select"
            >
              {candidates.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-sm font-medium text-gray-700">Target folder</div>
              <select
                className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={folderTrim}
                onChange={(e) => setTargetFolder(e.target.value)}
                data-testid="move-doc-folder-select"
              >
                <option value="">(root)</option>
                {folderNames.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-gray-500">
                Existing folders:{" "}
                {folderNames.length ? (
                  <span className="font-mono">{folderNames.join(", ")}</span>
                ) : (
                  <span>(none)</span>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-gray-700">Filename</div>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={targetFilename}
                onChange={(e) => setTargetFilename(e.target.value)}
                placeholder="filename.ext"
                data-testid="move-doc-filename-input"
              />
              <div className="mt-1 text-xs text-gray-500">
                Destination: <span className="font-mono">{destRel}</span>
              </div>
              {conflict && !isNoop && (
                <div className="mt-1 text-xs text-red-600" data-testid="move-doc-error">
                  A file already exists at that destination. Choose a different folder or filename.
                </div>
              )}
              {isNoop && (
                <div className="mt-1 text-xs text-gray-500" data-testid="move-doc-noop">
                  Select a different destination or change the filename.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            data-testid="move-doc-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm({
                targetWorkbookId: workbookTrim,
                targetFolder: folderTrim || undefined,
                targetFilename: filenameTrim,
              })
            }
            className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            data-testid="move-doc-ok"
          >
            Move
          </button>
        </div>
      </div>
    </>
  );
}
