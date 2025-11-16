/**
 * List all review types and their schemas
 */

import type { StorageProvider } from "../storage/interface.js";

export interface ListTypesResult {
  types: Array<{
    name: string;
    schema: Array<{
      name: string;
      type: string;
    }>;
    recordCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * List all review types with their schemas and record counts
 */
export async function listTypes(storage: StorageProvider): Promise<ListTypesResult> {
  const typeNames = await storage.listTypes();

  const types = await Promise.all(
    typeNames.map(async (name) => {
      const typeData = await storage.readType(name);
      return {
        name: typeData.name,
        schema: typeData.schema,
        recordCount: typeData.records.length,
        createdAt: typeData.createdAt,
        updatedAt: typeData.updatedAt,
      };
    })
  );

  return { types };
}

/**
 * Get a specific review type with all its details
 */
export async function getType(storage: StorageProvider, typeName: string) {
  const typeData = await storage.readType(typeName);
  return {
    name: typeData.name,
    schema: typeData.schema,
    records: typeData.records,
    recordCount: typeData.records.length,
    createdAt: typeData.createdAt,
    updatedAt: typeData.updatedAt,
  };
}
