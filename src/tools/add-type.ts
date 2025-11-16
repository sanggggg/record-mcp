/**
 * Add a new review type
 */

import { StorageProvider } from '../storage/interface.js';
import { FieldDefinition, ReviewTypeData } from '../types.js';
import { validateTypeName, validateSchema, getCurrentTimestamp } from '../utils/validation.js';

export interface AddTypeParams {
  name: string;
  fields: Array<{ name: string; type: string }>;
}

export interface AddTypeResult {
  success: boolean;
  typeName: string;
  message: string;
}

/**
 * Add a new review type with schema
 */
export async function addType(
  storage: StorageProvider,
  params: AddTypeParams
): Promise<AddTypeResult> {
  // Validate type name
  const typeName = validateTypeName(params.name);

  // Check if type already exists
  const exists = await storage.typeExists(typeName);
  if (exists) {
    throw new Error(`Review type "${typeName}" already exists`);
  }

  // Validate schema
  const schema: FieldDefinition[] = validateSchema(params.fields);

  // Check for duplicate field names
  const fieldNames = new Set<string>();
  for (const field of schema) {
    if (fieldNames.has(field.name)) {
      throw new Error(`Duplicate field name: ${field.name}`);
    }
    fieldNames.add(field.name);
  }

  // Create new review type
  const now = getCurrentTimestamp();
  const typeData: ReviewTypeData = {
    name: typeName,
    schema,
    records: [],
    createdAt: now,
    updatedAt: now,
  };

  // Save to storage
  await storage.writeType(typeName, typeData);

  return {
    success: true,
    typeName,
    message: `Review type "${typeName}" created successfully with ${schema.length} fields`,
  };
}
