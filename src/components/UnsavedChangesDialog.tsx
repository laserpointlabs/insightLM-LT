import { useEffect, useRef } from "react";
import { testIds } from "../testing/testIds";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  isOpen,
  title,
  message,
  onSave,
  onDontSave,
  onCancel,
}: UnsavedChangesDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Safer default: focus Cancel so Enter doesn't accidentally discard/save.
    setTimeout(() => cancelRef.current?.focus(), 0);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50"
        onClick={onCancel}
        data-testid={testIds.unsavedCloseDialog.backdrop}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        data-testid={testIds.unsavedCloseDialog.dialog}
      >
        <h3 className="mb-2 text-lg font-semibold" data-testid={testIds.unsavedCloseDialog.title}>
          {title}
        </h3>
        <p className="mb-4 text-sm text-gray-600" data-testid={testIds.unsavedCloseDialog.message}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            ref={cancelRef}
            data-testid={testIds.unsavedCloseDialog.cancel}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDontSave}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
            data-testid={testIds.unsavedCloseDialog.dontSave}
          >
            Don’t Save
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            data-testid={testIds.unsavedCloseDialog.save}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
