import { ipcMain } from "electron";
import { ConfigService, type AppConfig, type LLMConfig } from "../services/configService";
import { LLMService } from "../services/llmService";

function isProvider(x: any): x is "openai" | "claude" | "ollama" {
  return x === "openai" || x === "claude" || x === "ollama";
}

export function setupConfigIPC(configService: ConfigService, llmService: LLMService) {
  ipcMain.handle("config:get", async () => {
    return {
      app: configService.loadAppConfig(),
      llm: configService.loadLLMConfig(),
    };
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

  ipcMain.handle("config:updateLLM", async (_evt, updates: Partial<LLMConfig>) => {
    const current = configService.loadLLMConfig();
    const provider = isProvider((updates as any)?.provider) ? (updates as any).provider : current.provider;
    const next: LLMConfig = {
      ...current,
      ...updates,
      provider,
      model: String((updates as any)?.model ?? current.model ?? "gpt-4").trim() || String(current.model || "gpt-4"),
      apiKey: typeof (updates as any)?.apiKey === "string" ? (updates as any).REDACTED
      baseUrl: typeof (updates as any)?.baseUrl === "string" ? (updates as any).baseUrl : current.baseUrl,
    };

    // Persist to YAML and apply live to the running LLM service.
    configService.saveLLMConfig(next);
    llmService.setConfig(next);

    // Keep app.yaml llmProvider in sync for clarity.
    try {
      const appCfg = configService.loadAppConfig();
      if (appCfg.llmProvider !== next.provider) {
        configService.saveAppConfig({ ...appCfg, llmProvider: next.provider });
      }
    } catch {
      // ignore
    }

    return { llm: configService.loadLLMConfig() };
  });
}

