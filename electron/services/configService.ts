import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

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
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return path.join(process.cwd(), "config");
  }
  return path.join(process.resourcesPath || process.cwd(), "config");
}

export class ConfigService {
  private appConfig: AppConfig | null = null;
  private llmConfig: LLMConfig | null = null;

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
}
