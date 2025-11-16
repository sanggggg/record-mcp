/**
 * Storage provider factory
 * Creates the appropriate storage provider based on configuration
 */

import 'dotenv/config';
import { StorageProvider } from './interface.js';
import { LocalStorageProvider } from './local.js';
import { R2StorageProvider } from './r2.js';
import { Config, StorageProviderType } from '../types.js';

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const storageProvider = (process.env.STORAGE_PROVIDER || 'local') as StorageProviderType;
  const localDataPath = process.env.LOCAL_DATA_PATH || './data';

  const config: Config = {
    storageProvider,
    localDataPath,
  };

  // Load R2 config if provider is R2
  if (storageProvider === 'r2') {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error(
        'R2 configuration missing. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME'
      );
    }

    config.r2Config = {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      endpoint: process.env.R2_ENDPOINT,
    };
  }

  return config;
}

/**
 * Create storage provider based on configuration
 */
export function createStorageProvider(config?: Config): StorageProvider {
  const cfg = config || loadConfig();

  switch (cfg.storageProvider) {
    case 'local':
      return new LocalStorageProvider(cfg.localDataPath);

    case 'r2':
      if (!cfg.r2Config) {
        throw new Error('R2 configuration is required when using R2 storage provider');
      }
      return new R2StorageProvider(cfg.r2Config);

    default:
      throw new Error(`Unknown storage provider: ${cfg.storageProvider}`);
  }
}
