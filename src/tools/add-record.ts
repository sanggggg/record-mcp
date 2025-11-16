/**
 * Add a review record to a type
 */

import type { StorageProvider } from "../storage/interface.js";
import type { ReviewRecord } from "../types.js";
import {
  generateId,
  getCurrentTimestamp,
  validateRecordAgainstSchema,
  validateTypeName,
} from "../utils/validation.js";

export interface AddRecordParams {
  typeName: string;
  data: Record<string, unknown>;
}

export interface AddRecordResult {
  success: boolean;
  typeName: string;
  recordId: string;
  message: string;
}

/**
 * Add a new review record to a type
 */
export async function addRecord(
  storage: StorageProvider,
  params: AddRecordParams
): Promise<AddRecordResult> {
  // Validate type name
  const typeName = validateTypeName(params.typeName);

  // Check if type exists
  const exists = await storage.typeExists(typeName);
  if (!exists) {
    throw new Error(`Review type "${typeName}" does not exist`);
  }

  // Read existing type data
  const typeData = await storage.readType(typeName);

  // Validate record against schema
  validateRecordAgainstSchema(params.data, typeData.schema);

  // Create new record
  const recordId = generateId();
  const newRecord: ReviewRecord = {
    id: recordId,
    data: params.data as Record<string, string | number | boolean>,
    createdAt: getCurrentTimestamp(),
  };

  // Add record to type
  typeData.records.push(newRecord);
  typeData.updatedAt = getCurrentTimestamp();

  // Save updated type data
  await storage.writeType(typeName, typeData);

  return {
    success: true,
    typeName,
    recordId,
    message: `Record added to "${typeName}" with ID: ${recordId}`,
  };
}
