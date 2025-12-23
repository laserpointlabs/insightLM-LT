import { useNotificationStore } from "../store/notificationStore";

export function notifySuccess(message: string, title?: string) {
  useNotificationStore.getState().push({ kind: "success", message, title });
}

export function notifyError(message: string, title?: string) {
  useNotificationStore.getState().push({ kind: "error", message, title });
}

export function notifyInfo(message: string, title?: string) {
  useNotificationStore.getState().push({ kind: "info", message, title });
}






