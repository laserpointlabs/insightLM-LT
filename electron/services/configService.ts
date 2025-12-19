import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { app } from "electron";

export interface AppConfig {
  dataDir: string;
  llmProvider: "openai" | "claude" | "ollama";
}

export interface LLMConfig {
  provider: "openai" | "claude" | "ollama";
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export type LLMProvider = LLMConfig["provider"];

export type LLMProfile = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

export type LLMConfigStore = {
  activeProvider: LLMProvider;
  profiles: Record<LLMProvider, LLMProfile>;
};

function expandEnvVars(str: string): string {
  return str.replace(/\$\{(\w+)\}/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

function expandPath(pathStr: string): string {
  const expanded = expandEnvVars(pathStr);
  if (expanded.includes("%APPDATA%")) {
    const appData =
      process.env.APPDATA ||
      (process.platform === "win32"
        ? path.join(process.env.USERPROFILE || "", "AppData", "Roaming")
        : path.join(process.env.HOME || "", ".config"));
    return expanded.replace("%APPDATA%", appData);
  }
  return expanded;
}

function getConfigDir(): string {
  // Check if config directory exists in project root (development)
  const projectConfigDir = path.join(process.cwd(), "config");
  if (fs.existsSync(projectConfigDir)) {
    return projectConfigDir;
  }

  // In production (packaged), use resourcesPath/config
  // Also check app.isPackaged if app is available
  try {
    if (app && app.isPackaged && process.resourcesPath) {
      return path.join(process.resourcesPath, "config");
    }
  } catch (e) {
    // app might not be available in some contexts
  }

  // Fallback to project root
  return projectConfigDir;
}

export class ConfigService {
  private appConfig: AppConfig | null = null;
  private llmConfig: LLMConfig | null = null;
  private llmStore: LLMConfigStore | null = null;

  private getUserConfigDir(): string {
    const appCfg = this.loadAppConfig();
    return path.join(appCfg.dataDir, "config");
  }

  private getUserConfigPath(filename: string): string {
    return path.join(this.getUserConfigDir(), filename);
  }

  private ensureUserConfigDir(): void {
    const dir = this.getUserConfigDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Ensure a user-writable LLM config exists in AppData, seeded from the packaged/dev config if present.
   */
  private ensureUserLLMConfigExists(): string {
    this.ensureUserConfigDir();
    const userPath = this.getUserConfigPath("llm.yaml");
    if (fs.existsSync(userPath)) return userPath;

    const basePath = path.join(getConfigDir(), "llm.yaml");
    try {
      if (fs.existsSync(basePath)) {
        fs.copyFileSync(basePath, userPath);
        return userPath;
      }
    } catch {
      // ignore seed failure; fall through to default write
    }

    const defaults = this.defaultStore();
    const toWrite: any = {
      activeProvider: defaults.activeProvider,
      profiles: {
        openai: { ...defaults.profiles.openai },
        claude: { ...defaults.profiles.claude },
        ollama: { ...defaults.profiles.ollama },
      },
    };
    fs.writeFileSync(userPath, yaml.dump(toWrite, { lineWidth: 120 }), "utf-8");
    return userPath;
  }

  readLLMYamlRaw(): { path: string; content: string } {
    const p = this.ensureUserLLMConfigExists();
    const content = fs.readFileSync(p, "utf-8");
    return { path: p, content };
  }

  saveLLMYamlRaw(rawYaml: string): { path: string } {
    const p = this.ensureUserLLMConfigExists();
    // Validate YAML parses (fail-fast for UX).
    yaml.load(String(rawYaml ?? ""));
    fs.writeFileSync(p, String(rawYaml ?? ""), "utf-8");
    this.clearCache();
    return { path: p };
  }

  private isProvider(x: any): x is LLMProvider {
    return x === "openai" || x === "claude" || x === "ollama";
  }

  private defaultStore(): LLMConfigStore {
    return {
      activeProvider: "openai",
      profiles: {
        openai: { model: "gpt-4o", apiKey: "${OPENAI_API_KEY}" },
        claude: { model: "claude-3-5-sonnet-20241022", apiKey: "${ANTHROPIC_API_KEY}" },
        ollama: { model: "llama3.2:1b", baseUrl: "http://localhost:11434", apiKey: "${LMAPI_KEY}" },
      },
    };
  }

  clearCache() {
    this.appConfig = null;
    this.llmConfig = null;
    this.llmStore = null;
  }

  loadAppConfig(): AppConfig {
    if (this.appConfig) return this.appConfig;

    try {
      const configPath = path.join(getConfigDir(), "app.yaml");
      const content = fs.readFileSync(configPath, "utf-8");
      const config = yaml.load(content) as AppConfig;

      config.dataDir = expandPath(config.dataDir);

      this.appConfig = config;
      return config;
    } catch (error) {
      console.error("Failed to load app config:", error);
      const defaultDataDir = expandPath("%APPDATA%/insightLM-LT");
      this.appConfig = {
        dataDir: defaultDataDir,
        llmProvider: "openai",
      };
      return this.appConfig;
    }
  }

  loadLLMConfig(): LLMConfig {
    if (this.llmConfig) return this.llmConfig;

    try {
      const store = this.loadLLMConfigStore();
      const active = store.activeProvider;
      const p = store.profiles[active] || {};

      const model =
        String(p.model || "").trim() ||
        (active === "openai"
          ? "gpt-4o"
          : active === "claude"
            ? "claude-3-5-sonnet-20241022"
            : "llama3.2:1b");

      const cfg: LLMConfig = {
        provider: active,
        model,
      };
      if (typeof p.apiKey === "string") cfg.apiKey = p.apiKey;
      if (typeof p.baseUrl === "string") cfg.baseUrl = p.baseUrl;

      this.llmConfig = cfg;
      return cfg;
    } catch (error) {
      console.error("Failed to load LLM config:", error);
      this.llmConfig = {
        provider: "openai",
        model: "gpt-4",
      };
      return this.llmConfig;
    }
  }

  loadLLMConfigStore(): LLMConfigStore {
    if (this.llmStore) return this.llmStore;

    const defaults = this.defaultStore();
    try {
      const configPath = this.ensureUserLLMConfigExists();
      const content = fs.readFileSync(configPath, "utf-8");
      const raw = (yaml.load(content) as any) || {};

      // New format:
      // activeProvider: openai|claude|ollama
      // profiles:
      //   openai: { apiKey, model }
      //   claude: { apiKey, model }
      //   ollama: { apiKey, model, baseUrl }
      if (raw && typeof raw === "object" && raw.profiles && typeof raw.profiles === "object") {
        const activeProvider: LLMProvider =
          this.isProvider(raw.activeProvider)
            ? raw.activeProvider
            : this.isProvider(raw.provider)
              ? raw.provider
              : this.loadAppConfig().llmProvider;

        const profiles: Record<LLMProvider, LLMProfile> = {
          openai: { ...defaults.profiles.openai, ...(raw.profiles.openai || {}) },
          claude: { ...defaults.profiles.claude, ...(raw.profiles.claude || {}) },
          ollama: { ...defaults.profiles.ollama, ...(raw.profiles.ollama || {}) },
        };

        // Expand env vars per-profile (apiKey/baseUrl only).
        for (const prov of ["openai", "claude", "ollama"] as LLMProvider[]) {
          const p = profiles[prov] || {};
          if (typeof p.apiKey === "string") p.apiKey = expandEnvVars(p.apiKey);
          if (typeof p.baseUrl === "string") p.baseUrl = expandEnvVars(p.baseUrl);
          profiles[prov] = p;
        }

        this.llmStore = { activeProvider, profiles };
        return this.llmStore;
      }

      // Legacy format:
      // provider, apiKey, model, baseUrl
      const legacyProvider: LLMProvider =
        this.isProvider(raw.provider) ? raw.provider : this.loadAppConfig().llmProvider;

      const profiles: Record<LLMProvider, LLMProfile> = {
        ...defaults.profiles,
      };
      const legacyProfile: LLMProfile = {
        apiKey: typeof raw.apiKey === "string" ? expandEnvVars(raw.apiKey) : profiles[legacyProvider].apiKey,
        model: typeof raw.model === "string" ? raw.model : profiles[legacyProvider].model,
        baseUrl: typeof raw.baseUrl === "string" ? expandEnvVars(raw.baseUrl) : profiles[legacyProvider].baseUrl,
      };
      profiles[legacyProvider] = { ...profiles[legacyProvider], ...legacyProfile };

      this.llmStore = { activeProvider: legacyProvider, profiles };
      return this.llmStore;
    } catch (e) {
      // fail-soft defaults
      const appProv = this.loadAppConfig().llmProvider;
      this.llmStore = { ...defaults, activeProvider: appProv };
      return this.llmStore;
    }
  }

  saveAppConfig(config: AppConfig): void {
    const configPath = path.join(getConfigDir(), "app.yaml");
    const toWrite: AppConfig = {
      dataDir: config.dataDir,
      llmProvider: config.llmProvider,
    };
    fs.writeFileSync(configPath, yaml.dump(toWrite, { lineWidth: 120 }), "utf-8");
    this.clearCache();
  }

  saveLLMConfig(config: LLMConfig): void {
    // Back-compat entry point: update just the active provider profile and persist store format.
    const store = this.loadLLMConfigStore();
    const provider = config.provider;
    store.activeProvider = provider;
    store.profiles[provider] = {
      ...store.profiles[provider],
      REDACTED
      model: config.model,
      baseUrl: config.baseUrl,
    };
    this.saveLLMConfigStore(store);
  }

  saveLLMConfigStore(store: LLMConfigStore): void {
    const configPath = this.ensureUserLLMConfigExists();
    const toWrite: any = {
      activeProvider: store.activeProvider,
      profiles: {
        openai: { ...store.profiles.openai },
        claude: { ...store.profiles.claude },
        ollama: { ...store.profiles.ollama },
      },
    };
    // Drop undefined keys for a clean yaml file.
    for (const prov of ["openai", "claude", "ollama"] as LLMProvider[]) {
      Object.keys(toWrite.profiles[prov]).forEach((k) => {
        if (toWrite.profiles[prov][k] === undefined) delete toWrite.profiles[prov][k];
      });
    }
    fs.writeFileSync(configPath, yaml.dump(toWrite, { lineWidth: 120 }), "utf-8");
    this.clearCache();
  }
}
