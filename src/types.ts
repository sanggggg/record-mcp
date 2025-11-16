/**
 * Core type definitions for the dynamic review record system
 */

/**
 * Supported field types for review schemas
 */
export type FieldType = "string" | "number" | "boolean" | "date";

/**
 * Definition of a field in a review type's schema
 */
export interface FieldDefinition {
  name: string;
  type: FieldType;
}

/**
 * A single review record with dynamic data
 */
export interface ReviewRecord {
  id: string;
  data: Record<string, string | number | boolean>;
  createdAt: string; // ISO 8601 date string
}

/**
 * Complete data for a review type (schema + records)
 */
export interface ReviewTypeData {
  name: string;
  schema: FieldDefinition[];
  records: ReviewRecord[];
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string
}

/**
 * Index file structure for quick type listing
 */
export interface TypeIndex {
  types: string[];
  lastUpdated: string; // ISO 8601 date string
}

/**
 * Configuration for Cloudflare R2 storage
 */
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint?: string;
}

/**
 * Storage provider types
 */
export type StorageProviderType = "local" | "r2";

/**
 * Environment configuration
 */
export interface Config {
  storageProvider: StorageProviderType;
  localDataPath: string;
  r2Config?: R2Config;
}
