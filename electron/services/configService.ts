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

  clearCache() {
    this.appConfig = null;
    this.llmConfig = null;
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
      const configPath = path.join(getConfigDir(), "llm.yaml");
      const content = fs.readFileSync(configPath, "utf-8");
      const config = yaml.load(content) as LLMConfig;

      if (config.apiKey) {
        config.apiKey = expandEnvVars(config.apiKey);
      }
      if (config.baseUrl) {
        config.baseUrl = expandEnvVars(config.baseUrl);
      }

      this.llmConfig = config;
      return config;
    } catch (error) {
      console.error("Failed to load LLM config:", error);
      this.llmConfig = {
        provider: "openai",
        model: "gpt-4",
      };
      return this.llmConfig;
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
    const configPath = path.join(getConfigDir(), "llm.yaml");
    const toWrite: LLMConfig = {
      provider: config.provider,
      REDACTED
      model: config.model,
      baseUrl: config.baseUrl,
    };
    // Drop undefined keys for a clean yaml file.
    Object.keys(toWrite).forEach((k) => {
      if ((toWrite as any)[k] === undefined) delete (toWrite as any)[k];
    });
    fs.writeFileSync(configPath, yaml.dump(toWrite, { lineWidth: 120 }), "utf-8");
    this.clearCache();
  }
}
