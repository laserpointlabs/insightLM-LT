import { ipcMain } from "electron";
import { ConfigService, type AppConfig, type LLMConfig, type LLMConfigStore, type LLMProvider } from "../services/configService";
import { LLMService } from "../services/llmService";

function isProvider(x: any): x is "openai" | "claude" | "ollama" {
  return x === "openai" || x === "claude" || x === "ollama";
}

export function setupConfigIPC(configService: ConfigService, llmService: LLMService) {
  ipcMain.handle("config:get", async () => {
    const llmStore = configService.loadLLMConfigStore();
    return {
      app: configService.loadAppConfig(),
      llm: configService.loadLLMConfig(),
      llmStore,
    };
  });

  ipcMain.handle("config:getLLMRaw", async () => {
    return configService.readLLMYamlRaw();
  });

  ipcMain.handle("config:saveLLMRaw", async (_evt, rawYaml: string) => {
    // Save raw YAML, then apply to running LLM service and return updated parsed config.
    const saved = configService.saveLLMYamlRaw(rawYaml);
    const llmStore = configService.loadLLMConfigStore();
    const llm = configService.loadLLMConfig();
    llmService.setConfig(llm);
    return { ...saved, llmStore, llm };
  });

  ipcMain.handle("config:updateApp", async (_evt, updates: Partial<AppConfig>) => {
    const current = configService.loadAppConfig();
    const next: AppConfig = {
      ...current,
      ...updates,
      llmProvider: isProvider((updates as any)?.llmProvider) ? (updates as any).llmProvider : current.llmProvider,
    };
    configService.saveAppConfig(next);
    return { app: configService.loadAppConfig() };
  });

  ipcMain.handle("config:updateLLM", async (_evt, updates: any) => {
    const store: LLMConfigStore = configService.loadLLMConfigStore();

    const nextActive: LLMProvider =
      isProvider(updates?.activeProvider) ? updates.activeProvider : isProvider(updates?.provider) ? updates.provider : store.activeProvider;

    // Merge full profiles map if provided.
    if (updates?.profiles && typeof updates.profiles === "object") {
      for (const p of ["openai", "claude", "ollama"] as const) {
        const incoming = updates.profiles[p];
        if (incoming && typeof incoming === "object") {
          store.profiles[p] = { ...store.profiles[p], ...incoming };
        }
      }
    }

    // Also accept legacy-style updates (provider + fields) to update just that provider.
    const targetProvider: LLMProvider = isProvider(updates?.provider) ? updates.provider : nextActive;
    if (updates && (updates.model !== undefined || updates.apiKey !== undefined || updates.baseUrl !== undefined)) {
      store.profiles[targetProvider] = {
        ...store.profiles[targetProvider],
        model: typeof updates.model === "string" ? updates.model : store.profiles[targetProvider]?.model,
        apiKey: typeof updates.apiKey === "string" ? updates.REDACTED
        baseUrl: typeof updates.baseUrl === "string" ? updates.baseUrl : store.profiles[targetProvider]?.baseUrl,
      };
    }

    store.activeProvider = nextActive;

    configService.saveLLMConfigStore(store);

    // Apply live to running LLM service (active provider profile).
    const activeCfg = configService.loadLLMConfig();
    llmService.setConfig(activeCfg);

    // Keep app.yaml llmProvider in sync for clarity.
    try {
      const appCfg = configService.loadAppConfig();
      if (appCfg.llmProvider !== activeCfg.provider) {
        configService.saveAppConfig({ ...appCfg, llmProvider: activeCfg.provider });
      }
    } catch {
      // ignore
    }

    return { llm: activeCfg, llmStore: configService.loadLLMConfigStore() };
  });
}
