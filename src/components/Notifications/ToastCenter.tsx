import { useEffect } from "react";
import { useNotificationStore } from "../../store/notificationStore";

function kindClasses(kind: "success" | "error" | "info") {
  switch (kind) {
    case "success":
      return "border-green-200 bg-green-50 text-green-900";
    case "error":
      return "border-red-200 bg-red-50 text-red-900";
    case "info":
    default:
      return "border-blue-200 bg-blue-50 text-blue-900";
  }
}

export function ToastCenter() {
  const { toasts, remove } = useNotificationStore();

  useEffect(() => {
    const timers = toasts.map((t) => {
      if (!t.timeoutMs) return null;
      return window.setTimeout(() => remove(t.id), t.timeoutMs);
    });
    return () => {
      timers.forEach((id) => {
        if (id) window.clearTimeout(id);
      });
    };
  }, [toasts, remove]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[360px] max-w-[90vw] flex-col gap-2"
      data-testid="toast-center"
    >
      {toasts.slice(-4).map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded border px-3 py-2 shadow-lg ${kindClasses(t.kind)}`}
          role={t.kind === "error" ? "alert" : "status"}
          data-testid={`toast-${t.kind}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {t.title && <div className="text-xs font-semibold">{t.title}</div>}
              <div className="text-sm" data-testid="toast-message">{t.message}</div>
            </div>
            <button
              className="rounded px-2 py-1 text-xs opacity-70 hover:opacity-100"
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
              data-testid="toast-dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
