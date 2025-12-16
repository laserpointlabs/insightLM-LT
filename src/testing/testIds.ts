export const testIds = {
  activityBar: {
    item: (workbenchId: "file" | "data" | "analysis" | "event") => `activitybar-item-${workbenchId}`,
    file: "activitybar-item-file",
    data: "activitybar-item-data",
    analysis: "activitybar-item-analysis",
    event: "activitybar-item-event",
  },
  sidebar: {
    headers: {
      dashboards: "sidebar-dashboards-header",
      contexts: "sidebar-contexts-header",
      workbooks: "sidebar-workbooks-header",
      chat: "sidebar-chat-header",
    },
  },
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
    newChat: "chat-new",
    history: "chat-history",
    settings: "chat-settings",
  },
  toast: {
    center: "toast-center",
    message: "toast-message",
    dismiss: "toast-dismiss",
    kind: (kind: "success" | "error" | "info") => `toast-${kind}`,
  },
  inputDialog: {
    backdrop: "input-dialog-backdrop",
    title: "input-dialog-title",
    input: "input-dialog-input",
    cancel: "input-dialog-cancel",
    ok: "input-dialog-ok",
  },
  workbooks: {
    header: {
      create: "workbooks-create",
      refresh: "workbooks-refresh",
      collapseAll: "workbooks-collapse-all",
    },
    item: (workbookId: string) => `workbooks-item-${workbookId}`,
    toggle: (workbookId: string) => `workbooks-toggle-${workbookId}`,
    createMarkdown: (workbookId: string) => `workbooks-create-markdown-${workbookId}`,
    createDocument: (workbookId: string) => `workbooks-create-document-${workbookId}`,
    createFolder: (workbookId: string) => `workbooks-create-folder-${workbookId}`,
    action: (actionId: string, workbookId: string) => `workbooks-action-${actionId}-${workbookId}`,
    folder: (workbookId: string, folderName: string) =>
      `workbooks-folder-${workbookId}-${encodeURIComponent(String(folderName || ""))}`,
    folderCreateMarkdown: (workbookId: string, folderName: string) =>
      `workbooks-folder-create-markdown-${workbookId}-${encodeURIComponent(String(folderName || ""))}`,
    folderAddFiles: (workbookId: string, folderName: string) =>
      `workbooks-folder-addfiles-${workbookId}-${encodeURIComponent(String(folderName || ""))}`,
    folderAction: (actionId: string, workbookId: string, folderName: string) =>
      `workbooks-folder-action-${actionId}-${workbookId}-${encodeURIComponent(String(folderName || ""))}`,
    doc: (workbookId: string, docPathOrName: string) =>
      `workbooks-doc-${workbookId}-${encodeURIComponent(String(docPathOrName || ""))}`,
    docRename: (workbookId: string, docRelativePath: string) =>
      `workbooks-doc-rename-${workbookId}-${encodeURIComponent(String(docRelativePath || ""))}`,
    docMove: (workbookId: string, docRelativePath: string) =>
      `workbooks-doc-move-${workbookId}-${encodeURIComponent(String(docRelativePath || ""))}`,
    docDelete: (workbookId: string, docRelativePath: string) =>
      `workbooks-doc-delete-${workbookId}-${encodeURIComponent(String(docRelativePath || ""))}`,
    contextMenu: {
      docRename: "workbooks-doc-context-rename",
      docMove: "workbooks-doc-context-move",
      docDelete: "workbooks-doc-context-delete",
      folderMove: "workbooks-folder-context-move",
      folderRename: "workbooks-folder-context-rename",
      folderDelete: "workbooks-folder-context-delete",
    },
    collision: {
      backdrop: "collision-dialog-backdrop",
      dialog: "collision-dialog",
      title: "collision-dialog-title",
      message: "collision-dialog-message",
      renameInput: "collision-dialog-rename-input",
      rename: "collision-dialog-rename",
      overwrite: "collision-dialog-overwrite",
      skip: "collision-dialog-skip",
      applyAll: "collision-dialog-apply-all",
    },
    moveFolder: {
      backdrop: "move-folder-dialog-backdrop",
      dialog: "move-folder-dialog",
      title: "move-folder-title",
      workbookSelect: "move-folder-workbook-select",
      folderInput: "move-folder-folder-input",
      error: "move-folder-error",
      noop: "move-folder-noop",
      ok: "move-folder-ok",
      cancel: "move-folder-cancel",
    },
    moveDoc: {
      backdrop: "move-doc-dialog-backdrop",
      dialog: "move-doc-dialog",
      title: "move-doc-title",
      workbookSelect: "move-doc-workbook-select",
      folderSelect: "move-doc-folder-select",
      filenameInput: "move-doc-filename-input",
      error: "move-doc-error",
      noop: "move-doc-noop",
      ok: "move-doc-ok",
      cancel: "move-doc-cancel",
    },
  },
} as const;
