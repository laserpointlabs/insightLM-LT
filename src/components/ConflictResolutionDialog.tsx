import { useEffect, useRef, useState } from "react";
import { testIds } from "../testing/testIds";

export type CollisionResolution = {
  action: "rename" | "overwrite" | "skip";
  newName?: string;
  applyToAll?: boolean;
};

export interface ConflictResolutionDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  defaultName: string;
  allowApplyToAll?: boolean;
  onCancel: () => void; // treated as skip
  onResolve: (resolution: CollisionResolution) => void;
}

export function ConflictResolutionDialog({
  isOpen,
  title,
  message,
  defaultName,
  allowApplyToAll = false,
  onCancel,
  onResolve,
}: ConflictResolutionDialogProps) {
  const [name, setName] = useState(defaultName);
  const [applyToAll, setApplyToAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName);
    setApplyToAll(false);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const trimmed = (name || "").trim();
  const canRename = !!trimmed;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key === "Enter") {
      if (!canRename) return;
      e.preventDefault();
      e.stopPropagation();
      onResolve({ action: "rename", newName: trimmed, applyToAll });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50"
        onClick={onCancel}
        data-testid={testIds.workbooks.collision.backdrop}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        data-testid={testIds.workbooks.collision.dialog}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h3 className="mb-2 text-lg font-semibold" data-testid={testIds.workbooks.collision.title}>
          {title}
        </h3>
        <p className="mb-3 text-sm text-gray-700 whitespace-pre-wrap" data-testid={testIds.workbooks.collision.message}>
          {message}
        </p>

        <div className="mb-3">
          <div className="mb-1 text-sm font-medium text-gray-700">Rename to</div>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid={testIds.workbooks.collision.renameInput}
          />
        </div>

        {allowApplyToAll && (
          <label className="mb-3 flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              data-testid={testIds.workbooks.collision.applyAll}
            />
            Apply this choice to all remaining collisions in this operation
          </label>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onResolve({ action: "skip", applyToAll })}
            className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            data-testid={testIds.workbooks.collision.skip}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onResolve({ action: "overwrite", applyToAll })}
            className="rounded bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
            data-testid={testIds.workbooks.collision.overwrite}
          >
            Overwrite
          </button>
          <button
            type="button"
            disabled={!trimmed}
            onClick={() => onResolve({ action: "rename", newName: trimmed, applyToAll })}
            className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            data-testid={testIds.workbooks.collision.rename}
          >
            Rename
          </button>
        </div>
      </div>
    </>
  );
}
