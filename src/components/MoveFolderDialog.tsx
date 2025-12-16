import { useEffect, useMemo, useState } from "react";
import { testIds } from "../testing/testIds";

type WorkbookInfo = {
  id: string;
  name: string;
  archived?: boolean;
  folders?: string[] | null;
};

export interface MoveFolderDialogProps {
  isOpen: boolean;
  workbooks: WorkbookInfo[];
  sourceWorkbookId: string;
  sourceFolderName: string;
  onCancel: () => void;
  onConfirm: (targetWorkbookId: string, targetFolderName: string) => void;
}

export function MoveFolderDialog({
  isOpen,
  workbooks,
  sourceWorkbookId,
  sourceFolderName,
  onCancel,
  onConfirm,
}: MoveFolderDialogProps) {
  const candidates = useMemo(
    () => (Array.isArray(workbooks) ? workbooks.filter((w) => !w.archived) : []),
    [workbooks],
  );

  const [targetWorkbookId, setTargetWorkbookId] = useState<string>("");
  const [targetFolderName, setTargetFolderName] = useState<string>(sourceFolderName);

  useEffect(() => {
    if (!isOpen) return;
    const defaultTarget =
      candidates.find((w) => w.id !== sourceWorkbookId)?.id || sourceWorkbookId || candidates[0]?.id || "";
    setTargetWorkbookId(defaultTarget);
    setTargetFolderName(sourceFolderName);
  }, [isOpen, candidates, sourceWorkbookId, sourceFolderName]);

  const selected = candidates.find((w) => w.id === targetWorkbookId);
  const existingFolders = Array.isArray(selected?.folders) ? selected!.folders! : [];

  const sourceTrim = (sourceFolderName || "").trim();
  const folderTrim = (targetFolderName || "").trim();
  const workbookTrim = (targetWorkbookId || "").trim();

  const isSameWorkbook = workbookTrim === sourceWorkbookId;
  const isNoop = isSameWorkbook && folderTrim === sourceTrim;
  const folderExists = existingFolders.includes(folderTrim);
  const folderConflict = workbookTrim !== sourceWorkbookId && folderExists;

  const canSubmit =
    !!workbookTrim && !!folderTrim && !isNoop && !folderConflict;

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50"
        onClick={onCancel}
        data-testid={testIds.workbooks.moveFolder.backdrop}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        data-testid={testIds.workbooks.moveFolder.dialog}
      >
        <div className="mb-3">
          <h3 className="text-lg font-semibold" data-testid={testIds.workbooks.moveFolder.title}>
            Move Folder
          </h3>
          <div className="mt-1 text-xs text-gray-500">
            Moving: <span className="font-mono">/{sourceTrim}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-sm font-medium text-gray-700">Target workbook</div>
            <select
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={targetWorkbookId}
              onChange={(e) => setTargetWorkbookId(e.target.value)}
              data-testid={testIds.workbooks.moveFolder.workbookSelect}
            >
              {candidates.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-gray-700">Folder name (in target)</div>
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={targetFolderName}
              onChange={(e) => setTargetFolderName(e.target.value)}
              placeholder="Folder name…"
              data-testid={testIds.workbooks.moveFolder.folderInput}
            />
            <div className="mt-1 text-xs text-gray-500">
              Existing folders:{" "}
              {existingFolders.length ? (
                <span className="font-mono">{existingFolders.join(", ")}</span>
              ) : (
                <span>(none)</span>
              )}
            </div>
            {folderConflict && (
              <div className="mt-1 text-xs text-red-600" data-testid={testIds.workbooks.moveFolder.error}>
                A folder named “{folderTrim}” already exists in the target workbook. Choose a different name.
              </div>
            )}
            {isNoop && (
              <div className="mt-1 text-xs text-gray-500" data-testid={testIds.workbooks.moveFolder.noop}>
                Select a different workbook or change the folder name.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            data-testid={testIds.workbooks.moveFolder.cancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm(workbookTrim, folderTrim)}
            className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            data-testid={testIds.workbooks.moveFolder.ok}
          >
            Move
          </button>
        </div>
      </div>
    </>
  );
}
