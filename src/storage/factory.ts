/**
 * Storage provider factory
 * Creates the appropriate storage provider based on configuration
 */

import "dotenv/config";
import type { Config, StorageProviderType } from "../types.js";
import type { StorageProvider } from "./interface.js";
import { LocalStorageProvider } from "./local.js";
import { R2StorageProvider } from "./r2.js";

/**
 * Load configuration from environment variables
 * Supports both Node.js process.env and Cloudflare Worker env object
 */
export function loadConfig(env?: Record<string, string | undefined>): Config {
  // Use provided env object (for Cloudflare Workers) or process.env (for Node.js)
  const envSource = env || process.env;

  const storageProvider = (envSource.STORAGE_PROVIDER || "local") as StorageProviderType;
  const localDataPath = envSource.LOCAL_DATA_PATH || "./data";

  const config: Config = {
    storageProvider,
    localDataPath,
  };

  // Load R2 config if provider is R2
  if (storageProvider === "r2") {
    const accountId = envSource.R2_ACCOUNT_ID;
    const accessKeyId = envSource.R2_ACCESS_KEY_ID;
    const secretAccessKey = envSource.R2_SECRET_ACCESS_KEY;
    const bucketName = envSource.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        "R2 configuration missing. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME"
      );
    }

    config.r2Config = {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      endpoint: envSource.R2_ENDPOINT,
    };
  }

  return config;
}

/**
 * Create storage provider based on configuration
 */
export function createStorageProvider(
  configOrEnv?: Config | Record<string, string | undefined>
): StorageProvider {
  // Check if configOrEnv is a Config object or env variables
  let cfg: Config;

  if (!configOrEnv) {
    cfg = loadConfig();
  } else if ('storageProvider' in configOrEnv) {
    // It's a Config object
    cfg = configOrEnv as Config;
  } else {
    // It's an env object (for Cloudflare Workers)
    cfg = loadConfig(configOrEnv as Record<string, string | undefined>);
  }

  switch (cfg.storageProvider) {
    case "local":
      return new LocalStorageProvider(cfg.localDataPath);

    case "r2":
      if (!cfg.r2Config) {
        throw new Error("R2 configuration is required when using R2 storage provider");
      }
      return new R2StorageProvider(cfg.r2Config);

    default:
      throw new Error(`Unknown storage provider: ${cfg.storageProvider}`);
  }
}
