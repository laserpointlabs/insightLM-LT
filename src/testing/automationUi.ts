import { setAutomationState } from "./automationState";

declare global {
  interface Window {
    __insightlmAutomationUI?: {
      setMode: (enabled: boolean) => void;
      getMode: () => boolean;
    };
  }
}

function applyModeToDom(enabled: boolean) {
  // This is used by UI components to decide whether hover-only controls should be force-visible.
  document.body.dataset.automationMode = enabled ? "true" : "false";
}

export function initAutomationUI() {
  const getMode = () => document.body.dataset.automationMode === "true";

  const setMode = (enabled: boolean) => {
    setAutomationState({ ui: { forceVisibleControls: enabled } });
    applyModeToDom(enabled);
    window.dispatchEvent(new CustomEvent("automation:mode", { detail: { enabled } }));
  };

  // Initialize from existing global state if present; default off.
  const initial = Boolean(window.__insightlmAutomation?.ui?.forceVisibleControls);
  applyModeToDom(initial);

  window.__insightlmAutomationUI = { setMode, getMode };

  const onModeEvent = (e: any) => {
    const enabled = Boolean(e?.detail?.enabled);
    applyModeToDom(enabled);
  };
  window.addEventListener("automation:mode", onModeEvent as any);

  return () => {
    window.removeEventListener("automation:mode", onModeEvent as any);
  };
}




