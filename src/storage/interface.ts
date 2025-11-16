/**
 * Storage provider interface for abstracting local files vs R2
 */

import type { ReviewTypeData } from "../types.js";

/**
 * Abstract storage interface that works with both local files and Cloudflare R2
 */
export interface StorageProvider {
  /**
   * Initialize the storage provider (create directories, verify connections, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Read a specific review type's data
   * @param typeName - Name of the review type
   * @returns The review type data
   * @throws Error if type doesn't exist
   */
  readType(typeName: string): Promise<ReviewTypeData>;

  /**
   * Write/update a review type's data
   * @param typeName - Name of the review type
   * @param data - Complete review type data
   */
  writeType(typeName: string, data: ReviewTypeData): Promise<void>;

  /**
   * List all available review type names
   * @returns Array of type names
   */
  listTypes(): Promise<string[]>;

  /**
   * Delete a review type completely
   * @param typeName - Name of the review type to delete
   */
  deleteType(typeName: string): Promise<void>;

  /**
   * Check if a review type exists
   * @param typeName - Name of the review type
   * @returns True if exists, false otherwise
   */
  typeExists(typeName: string): Promise<boolean>;
}
