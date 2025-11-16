/**
 * Cloudflare R2 storage provider implementation
 */

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider } from './interface.js';
import { ReviewTypeData, TypeIndex, R2Config } from '../types.js';
import { ReviewTypeDataSchema } from '../utils/validation.js';

/**
 * Cloudflare R2 storage provider
 * Uses S3-compatible API to store review types in R2 bucket
 */
export class R2StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucketName: string;
  private readonly INDEX_KEY = 'index.json';
  private readonly TYPES_PREFIX = 'types/';

  constructor(config: R2Config) {
    const endpoint = config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.bucketName = config.bucketName;
  }

  /**
   * Initialize R2 storage by creating index if it doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      // Check if index exists
      const exists = await this.objectExists(this.INDEX_KEY);

      if (!exists) {
        // Create initial index
        const initialIndex: TypeIndex = {
          types: [],
          lastUpdated: new Date().toISOString(),
        };
        await this.putObject(this.INDEX_KEY, JSON.stringify(initialIndex, null, 2));
      }
    } catch (error) {
      throw new Error(`Failed to initialize R2 storage: ${error}`);
    }
  }

  /**
   * Read a review type from R2
   */
  async readType(typeName: string): Promise<ReviewTypeData> {
    try {
      const key = this.getTypeKey(typeName);
      const content = await this.getObject(key);

      if (!content) {
        throw new Error(`Review type "${typeName}" does not exist`);
      }

      const data = JSON.parse(content);
      return ReviewTypeDataSchema.parse(data);
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        throw error;
      }
      throw new Error(`Failed to read review type "${typeName}": ${error}`);
    }
  }

  /**
   * Write a review type to R2
   */
  async writeType(typeName: string, data: ReviewTypeData): Promise<void> {
    try {
      // Validate the data before writing
      ReviewTypeDataSchema.parse(data);

      const key = this.getTypeKey(typeName);
      const content = JSON.stringify(data, null, 2);

      await this.putObject(key, content);

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
      const content = await this.getObject(this.INDEX_KEY);

      if (!content) {
        return [];
      }

      const index: TypeIndex = JSON.parse(content);
      return index.types;
    } catch (error) {
      throw new Error(`Failed to list review types: ${error}`);
    }
  }

  /**
   * Delete a review type from R2
   */
  async deleteType(typeName: string): Promise<void> {
    try {
      const key = this.getTypeKey(typeName);

      // Check if exists
      const exists = await this.objectExists(key);
      if (!exists) {
        throw new Error(`Review type "${typeName}" does not exist`);
      }

      // Delete the object
      await this.deleteObject(key);

      // Remove from index
      await this.removeFromIndex(typeName);
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        throw error;
      }
      throw new Error(`Failed to delete review type "${typeName}": ${error}`);
    }
  }

  /**
   * Check if a review type exists in R2
   */
  async typeExists(typeName: string): Promise<boolean> {
    const key = this.getTypeKey(typeName);
    return await this.objectExists(key);
  }

  /**
   * Get the R2 object key for a review type
   */
  private getTypeKey(typeName: string): string {
    return `${this.TYPES_PREFIX}${typeName}.json`;
  }

  /**
   * Get an object from R2
   */
  private async getObject(key: string): Promise<string | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return null;
      }

      return await response.Body.transformToString();
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Put an object to R2
   */
  private async putObject(key: string, content: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: content,
      ContentType: 'application/json',
    });

    await this.client.send(command);
  }

  /**
   * Delete an object from R2
   */
  private async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Check if an object exists in R2
   */
  private async objectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Update the index with a new type
   */
  private async updateIndex(typeName: string): Promise<void> {
    try {
      const content = await this.getObject(this.INDEX_KEY);
      const index: TypeIndex = content ? JSON.parse(content) : { types: [], lastUpdated: '' };

      // Add type if not already in index
      if (!index.types.includes(typeName)) {
        index.types.push(typeName);
        index.types.sort(); // Keep alphabetically sorted
      }

      index.lastUpdated = new Date().toISOString();

      await this.putObject(this.INDEX_KEY, JSON.stringify(index, null, 2));
    } catch (error) {
      throw new Error(`Failed to update index: ${error}`);
    }
  }

  /**
   * Remove a type from the index
   */
  private async removeFromIndex(typeName: string): Promise<void> {
    try {
      const content = await this.getObject(this.INDEX_KEY);
      const index: TypeIndex = content ? JSON.parse(content) : { types: [], lastUpdated: '' };

      index.types = index.types.filter(t => t !== typeName);
      index.lastUpdated = new Date().toISOString();

      await this.putObject(this.INDEX_KEY, JSON.stringify(index, null, 2));
    } catch (error) {
      throw new Error(`Failed to update index: ${error}`);
    }
  }
}
