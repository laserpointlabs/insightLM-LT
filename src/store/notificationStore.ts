import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  createdAt: number;
  timeoutMs?: number;
};

interface NotificationStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "createdAt">) => string;
  remove: (id: string) => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id,
          createdAt,
          // Slightly longer by default so UI automation (and humans) can reliably see it.
          timeoutMs: toast.timeoutMs ?? (toast.kind === "error" ? 10000 : 6500),
          ...toast,
        },
      ],
    }));
    return id;
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
