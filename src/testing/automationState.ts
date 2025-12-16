export type AutomationContextSummary = {
  id: string;
  name: string;
  workbook_ids: string[];
};

export type AutomationState = {
  contexts?: {
    activeContextId: string | null;
    contexts: AutomationContextSummary[];
    updatedAt: number;
  };
  ui?: {
    forceVisibleControls: boolean;
  };
};

declare global {
  interface Window {
    __insightlmAutomation?: AutomationState;
  }
}

export function setAutomationState(next: Partial<AutomationState>) {
  window.__insightlmAutomation = {
    ...(window.__insightlmAutomation || {}),
    ...next,
  };
}
