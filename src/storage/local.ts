/**
 * Local file system storage provider implementation
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReviewTypeData, TypeIndex } from "../types.js";
import { ReviewTypeDataSchema } from "../utils/validation.js";
import type { StorageProvider } from "./interface.js";

/**
 * Local filesystem storage provider
 * Stores each review type as a separate JSON file
 */
export class LocalStorageProvider implements StorageProvider {
  private dataPath: string;
  private typesPath: string;
  private indexPath: string;

  constructor(dataPath: string = "./data") {
    this.dataPath = dataPath;
    this.typesPath = path.join(dataPath, "types");
    this.indexPath = path.join(dataPath, "index.json");
  }

  /**
   * Initialize storage by creating necessary directories
   */
  async initialize(): Promise<void> {
    try {
      // Create data directory
      await fs.mkdir(this.dataPath, { recursive: true });

      // Create types directory
      await fs.mkdir(this.typesPath, { recursive: true });

      // Create or verify index file
      try {
        await fs.access(this.indexPath);
      } catch {
        // Index doesn't exist, create it
        const initialIndex: TypeIndex = {
          types: [],
          lastUpdated: new Date().toISOString(),
        };
        await fs.writeFile(this.indexPath, JSON.stringify(initialIndex, null, 2), "utf-8");
      }
    } catch (error) {
      throw new Error(`Failed to initialize local storage: ${error}`);
    }
  }

  /**
   * Read a review type from filesystem
   */
  async readType(typeName: string): Promise<ReviewTypeData> {
    try {
      const filePath = this.getTypeFilePath(typeName);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content);

      // Validate the data structure
      return ReviewTypeDataSchema.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Review type "${typeName}" does not exist`);
      }
      throw new Error(`Failed to read review type "${typeName}": ${error}`);
    }
  }

  /**
   * Write a review type to filesystem
   */
  async writeType(typeName: string, data: ReviewTypeData): Promise<void> {
    try {
      // Validate the data before writing
      ReviewTypeDataSchema.parse(data);

      const filePath = this.getTypeFilePath(typeName);
      const content = JSON.stringify(data, null, 2);

      // Atomic write: write to temp file, then rename
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, content, "utf-8");
      await fs.rename(tempPath, filePath);

      // Update index
      await this.updateIndex(typeName);
    } catch (error) {
      throw new Error(`Failed to write review type "${typeName}": ${error}`);
    }
  }

  /**
   * List all review type names
   */
  async listTypes(): Promise<string[]> {
    try {
      const content = await fs.readFile(this.indexPath, "utf-8");
      const index: TypeIndex = JSON.parse(content);
      return index.types;
    } catch (error) {
      throw new Error(`Failed to list review types: ${error}`);
    }
  }

  /**
   * Delete a review type
   */
  async deleteType(typeName: string): Promise<void> {
    try {
      const filePath = this.getTypeFilePath(typeName);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Review type "${typeName}" does not exist`);
      }

      // Delete the file
      await fs.unlink(filePath);

      // Remove from index
      await this.removeFromIndex(typeName);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        throw error;
      }
      throw new Error(`Failed to delete review type "${typeName}": ${error}`);
    }
  }

  /**
   * Check if a review type exists
   */
  async typeExists(typeName: string): Promise<boolean> {
    try {
      const filePath = this.getTypeFilePath(typeName);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the file path for a review type
   */
  private getTypeFilePath(typeName: string): string {
    return path.join(this.typesPath, `${typeName}.json`);
  }

  /**
   * Update the index file with a new type
   */
  private async updateIndex(typeName: string): Promise<void> {
    try {
      const content = await fs.readFile(this.indexPath, "utf-8");
      const index: TypeIndex = JSON.parse(content);

      // Add type if not already in index
      if (!index.types.includes(typeName)) {
        index.types.push(typeName);
        index.types.sort(); // Keep alphabetically sorted
      }

      index.lastUpdated = new Date().toISOString();

      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf-8");
    } catch (error) {
      throw new Error(`Failed to update index: ${error}`);
    }
  }

  /**
   * Remove a type from the index file
   */
  private async removeFromIndex(typeName: string): Promise<void> {
    try {
      const content = await fs.readFile(this.indexPath, "utf-8");
      const index: TypeIndex = JSON.parse(content);

      index.types = index.types.filter((t) => t !== typeName);
      index.lastUpdated = new Date().toISOString();

      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf-8");
    } catch (error) {
      throw new Error(`Failed to update index: ${error}`);
    }
  }
}
