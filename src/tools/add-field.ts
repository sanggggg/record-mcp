/**
 * Add a field to an existing review type
 */

import type { StorageProvider } from "../storage/interface.js";
import type { FieldDefinition } from "../types.js";
import {
  getCurrentTimestamp,
  validateFieldDefinition,
  validateTypeName,
} from "../utils/validation.js";

export interface AddFieldParams {
  typeName: string;
  fieldName: string;
  fieldType: string;
}

export interface AddFieldResult {
  success: boolean;
  typeName: string;
  fieldName: string;
  message: string;
}

/**
 * Add a new field to an existing review type's schema
 */
export async function addField(
  storage: StorageProvider,
  params: AddFieldParams
): Promise<AddFieldResult> {
  // Validate type name
  const typeName = validateTypeName(params.typeName);

  // Check if type exists
  const exists = await storage.typeExists(typeName);
  if (!exists) {
    throw new Error(`Review type "${typeName}" does not exist`);
  }

  // Read existing type data
  const typeData = await storage.readType(typeName);

  // Validate new field
  const newField: FieldDefinition = validateFieldDefinition({
    name: params.fieldName,
    type: params.fieldType,
  });

  // Check if field already exists
  const fieldExists = typeData.schema.some((f) => f.name === newField.name);
  if (fieldExists) {
    throw new Error(`Field "${newField.name}" already exists in type "${typeName}"`);
  }

  // Add new field to schema
  typeData.schema.push(newField);
  typeData.updatedAt = getCurrentTimestamp();

  // Save updated type data
  await storage.writeType(typeName, typeData);

  return {
    success: true,
    typeName,
    fieldName: newField.name,
    message: `Field "${newField.name}" (${newField.type}) added to type "${typeName}"`,
  };
}
