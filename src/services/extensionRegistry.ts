import { ExtensionManifest, ViewContribution, CommandContribution, FileHandlerContribution, ContextProviderContribution, NotebookProviderContribution, WorkbookActionContribution } from '../types';

type Registered<T> = { extensionId: string; item: T };
type RegisteredFileHandler = { extensionId: string; item: FileHandlerContribution };

class ExtensionRegistry {
  private extensions: Map<string, ExtensionManifest> = new Map();
  private views: Map<string, Registered<ViewContribution>> = new Map();
  private commands: Map<string, Registered<CommandContribution>> = new Map();
  private fileHandlers: Map<string, RegisteredFileHandler[]> = new Map();
  private contextProviders: Map<string, Registered<ContextProviderContribution>> = new Map();
  private notebookProviders: Map<string, Registered<NotebookProviderContribution>> = new Map();
  private workbookActions: Map<string, Registered<WorkbookActionContribution>> = new Map();
  private enabledExtensions: Map<string, boolean> = new Map();
  private listeners: Set<() => void> = new Set();

  private readonly STORAGE_KEY = 'insightlm-extension-state';

  constructor() {
    this.loadExtensionState();
  }

  private loadExtensionState() {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([id, enabled]) => {
          this.enabledExtensions.set(id, Boolean(enabled));
        });
      }
    } catch (e) {
      console.warn('ExtensionRegistry: failed to load extension state', e);
    }
  }

  private saveExtensionState() {
    if (typeof localStorage === 'undefined') return;
    try {
      const obj: Record<string, boolean> = {};
      this.enabledExtensions.forEach((enabled, id) => {
        obj[id] = enabled;
      });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('ExtensionRegistry: failed to save extension state', e);
    }
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('ExtensionRegistry: listener error', err);
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  register(manifest: ExtensionManifest): void {
    // Validate manifest
    if (!manifest.id || !manifest.name) {
      throw new Error('Extension manifest must have id and name');
    }

    // Dev/StrictMode can call registration twice; avoid duplicating contributions (especially fileHandlers).
    if (this.extensions.has(manifest.id)) {
      return;
    }

    // Register the extension
    this.extensions.set(manifest.id, manifest);

    // Default enablement to stored value or true
    if (!this.enabledExtensions.has(manifest.id)) {
      this.enabledExtensions.set(manifest.id, true);
      this.saveExtensionState();
    }

    // Register contributions
    if (manifest.contributes) {
      // Register views
      if (manifest.contributes.views) {
        manifest.contributes.views.forEach(view => {
          this.views.set(view.id, { extensionId: manifest.id, item: view });
        });
      }

      // Register commands
      if (manifest.contributes.commands) {
        manifest.contributes.commands.forEach(command => {
          this.commands.set(command.id, { extensionId: manifest.id, item: command });
        });
      }

      // Register file handlers
      if (manifest.contributes.fileHandlers) {
        manifest.contributes.fileHandlers.forEach(handler => {
          handler.extensions.forEach(ext => {
            if (!this.fileHandlers.has(ext)) {
              this.fileHandlers.set(ext, []);
            }
            this.fileHandlers.get(ext)!.push({ extensionId: manifest.id, item: handler });
          });
        });
      }

      // Register context providers
      if (manifest.contributes.contextProviders) {
        manifest.contributes.contextProviders.forEach(provider => {
          this.contextProviders.set(provider.id, { extensionId: manifest.id, item: provider });
        });
      }

      // Register notebook providers
      if (manifest.contributes.notebookProviders) {
        manifest.contributes.notebookProviders.forEach(provider => {
          this.notebookProviders.set(provider.id, { extensionId: manifest.id, item: provider });
        });
      }

      // Register workbook toolbar actions
      if (manifest.contributes.workbookActions) {
        manifest.contributes.workbookActions.forEach(action => {
          this.workbookActions.set(action.id, { extensionId: manifest.id, item: action });
        });
      }
    }

    console.log(`Registered extension: ${manifest.name} (${manifest.id})`);
    this.syncMcpServer(manifest);
    this.notify();
  }

  isExtensionEnabled(id: string): boolean {
    return this.enabledExtensions.get(id) ?? false;
  }

  enableExtension(id: string): void {
    if (!this.extensions.has(id)) return;
    this.enabledExtensions.set(id, true);
    this.saveExtensionState();
    const manifest = this.extensions.get(id);
    if (manifest) {
      this.syncMcpServer(manifest);
    }
    this.notify();
  }

  disableExtension(id: string): void {
    if (!this.extensions.has(id)) return;
    this.enabledExtensions.set(id, false);
    this.saveExtensionState();
    const manifest = this.extensions.get(id);
    if (manifest) {
      this.syncMcpServer(manifest);
    }
    this.notify();
  }

  getExtension(id: string): ExtensionManifest | undefined {
    return this.extensions.get(id);
  }

  getAllExtensions(): ExtensionManifest[] {
    return Array.from(this.extensions.values());
  }

  getView(id: string): ViewContribution | undefined {
    const entry = this.views.get(id);
    if (!entry) return undefined;
    if (!this.isExtensionEnabled(entry.extensionId)) return undefined;
    return entry.item;
  }

  getCommand(id: string): CommandContribution | undefined {
    const entry = this.commands.get(id);
    if (!entry) return undefined;
    if (!this.isExtensionEnabled(entry.extensionId)) return undefined;
    return entry.item;
  }

  getFileHandlers(extension: string): FileHandlerContribution[] {
    const handlers = this.fileHandlers.get(extension) || [];
    return handlers
      .filter(h => this.isExtensionEnabled(h.extensionId))
      .sort((a, b) => (b.item.priority || 0) - (a.item.priority || 0))
      .map(h => h.item);
  }

  getContextProvider(id: string): ContextProviderContribution | undefined {
    const entry = this.contextProviders.get(id);
    if (!entry) return undefined;
    if (!this.isExtensionEnabled(entry.extensionId)) return undefined;
    return entry.item;
  }

  getAllContextProviders(): ContextProviderContribution[] {
    return Array.from(this.contextProviders.values())
      .filter(entry => this.isExtensionEnabled(entry.extensionId))
      .map(entry => entry.item);
  }

  getNotebookProvider(id: string): NotebookProviderContribution | undefined {
    const entry = this.notebookProviders.get(id);
    if (!entry) return undefined;
    if (!this.isExtensionEnabled(entry.extensionId)) return undefined;
    return entry.item;
  }

  getAllNotebookProviders(): NotebookProviderContribution[] {
    return Array.from(this.notebookProviders.values())
      .filter(entry => this.isExtensionEnabled(entry.extensionId))
      .map(entry => entry.item);
  }

  getWorkbookActions(): WorkbookActionContribution[] {
    return Array.from(this.workbookActions.values())
      .filter(entry => this.isExtensionEnabled(entry.extensionId))
      .map(entry => entry.item);
  }

  // Execute a command
  async executeCommand(id: string, ...args: any[]): Promise<any> {
    const entry = this.commands.get(id);
    if (!entry || !this.isExtensionEnabled(entry.extensionId)) {
      throw new Error(`Command not found: ${id}`);
    }
    return await entry.item.handler(...args);
  }

  // Get context from all providers
  async getContext(): Promise<string[]> {
    const contextPromises = Array.from(this.contextProviders.values()).map(
      provider => {
        if (!this.isExtensionEnabled(provider.extensionId)) {
          return Promise.resolve<string[]>([]);
        }
        return provider.item.provider();
      }
    );
    const contexts = await Promise.all(contextPromises);
    return contexts.flat();
  }

  private async syncMcpServer(manifest: ExtensionManifest) {
    if (!manifest.mcpServer) return;
    // Only attempt in renderer where window and electronAPI exist
    if (typeof window === 'undefined') return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.extensions?.setEnabled) return;

    const enabled = this.isExtensionEnabled(manifest.id);
    try {
      await electronAPI.extensions.setEnabled(manifest.id, enabled, manifest.mcpServer);
    } catch (err) {
      console.warn(`ExtensionRegistry: failed to sync MCP server for ${manifest.id}`, err);
      // Fail-soft: broadcast a UI event so the shell can show a non-blocking toast.
      try {
        const msg = err instanceof Error ? err.message : String(err);
        window.dispatchEvent(
          new CustomEvent("extensions:syncError", {
            detail: { extensionId: manifest.id, enabled, message: msg || "Failed to update extension server" },
          }),
        );
      } catch {
        // ignore
      }
    }
  }
}

// Create singleton instance
export const extensionRegistry = new ExtensionRegistry();
