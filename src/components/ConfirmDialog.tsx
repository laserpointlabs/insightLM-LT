import { useEffect, useRef } from "react";
import { testIds } from "../testing/testIds";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Safer default: focus Cancel so Enter does not accidentally confirm destructive actions.
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
        data-testid={testIds.confirmDialog.backdrop}
      />
      <div
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        data-testid={testIds.confirmDialog.dialog}
      >
        <h3 className="mb-2 text-lg font-semibold" data-testid={testIds.confirmDialog.title}>
          {title}
        </h3>
        <p className="mb-4 text-sm text-gray-600" data-testid={testIds.confirmDialog.message}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            ref={cancelRef}
            data-testid={testIds.confirmDialog.cancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
            data-testid={testIds.confirmDialog.confirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}
