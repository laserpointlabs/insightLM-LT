export const testIds = {
  contexts: {
    create: "contexts-create",
    refresh: "contexts-refresh",
    scopeToggle: "contexts-scope-toggle",
    scopeMode: "contexts-scope-mode",
    modal: {
      name: "contexts-modal-name",
      workbookCheckbox: "contexts-modal-workbook-checkbox",
      save: "contexts-modal-save",
      cancel: "contexts-modal-cancel",
    },
    item: (contextId: string) => `contexts-item-${contextId}`,
    edit: (contextId: string) => `contexts-edit-${contextId}`,
    activate: (contextId: string) => `contexts-activate-${contextId}`,
    delete: (contextId: string) => `contexts-delete-${contextId}`,
  },
  chat: {
    input: "chat-input",
    send: "chat-send",
  },
  toast: {
    center: "toast-center",
    message: "toast-message",
    dismiss: "toast-dismiss",
  },
  workbooks: {
    collision: {
      dialog: "collision-dialog",
      renameInput: "collision-dialog-rename-input",
      rename: "collision-dialog-rename",
      overwrite: "collision-dialog-overwrite",
      skip: "collision-dialog-skip",
      applyAll: "collision-dialog-apply-all",
    },
    moveFolder: {
      dialog: "move-folder-dialog",
      workbookSelect: "move-folder-workbook-select",
      folderInput: "move-folder-folder-input",
      ok: "move-folder-ok",
      cancel: "move-folder-cancel",
    },
    moveDoc: {
      dialog: "move-doc-dialog",
      workbookSelect: "move-doc-workbook-select",
      folderSelect: "move-doc-folder-select",
      filenameInput: "move-doc-filename-input",
      ok: "move-doc-ok",
      cancel: "move-doc-cancel",
    },
  },
} as const;
