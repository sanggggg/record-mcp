/**
 * Validation utilities for dynamic schemas and records
 */

import { z } from "zod";
import type { FieldDefinition, FieldType } from "../types.js";

/**
 * Zod schema for field type validation
 */
export const FieldTypeSchema = z.enum(["string", "number", "boolean", "date"]);

/**
 * Zod schema for field definition validation
 */
export const FieldDefinitionSchema = z.object({
  name: z.string().min(1, "Field name cannot be empty"),
  type: FieldTypeSchema,
});

/**
 * Zod schema for review record validation
 */
export const ReviewRecordSchema = z.object({
  id: z.string(),
  data: z.record(z.union([z.string(), z.number(), z.boolean()])),
  createdAt: z.string().datetime(),
});

/**
 * Zod schema for review type data validation
 */
export const ReviewTypeDataSchema = z.object({
  name: z.string().min(1, "Type name cannot be empty"),
  schema: z.array(FieldDefinitionSchema).min(1, "Schema must have at least one field"),
  records: z.array(ReviewRecordSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Validate a field definition
 */
export function validateFieldDefinition(field: unknown): FieldDefinition {
  return FieldDefinitionSchema.parse(field);
}

/**
 * Validate an array of field definitions
 */
export function validateSchema(schema: unknown): FieldDefinition[] {
  if (!Array.isArray(schema)) {
    throw new Error("Schema must be an array");
  }
  return schema.map(validateFieldDefinition);
}

/**
 * Validate a review type name
 */
export function validateTypeName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Type name must be a non-empty string");
  }

  // Check for valid characters (alphanumeric, hyphen, underscore)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error("Type name can only contain letters, numbers, hyphens, and underscores");
  }

  return name.trim();
}

/**
 * Validate that a record matches its type's schema
 */
export function validateRecordAgainstSchema(
  record: Record<string, unknown>,
  schema: FieldDefinition[]
): void {
  const schemaFields = new Set(schema.map((f) => f.name));
  const recordFields = new Set(Object.keys(record));

  // Check for missing required fields
  for (const field of schema) {
    if (!recordFields.has(field.name)) {
      throw new Error(`Missing required field: ${field.name}`);
    }
  }

  // Check for extra fields
  for (const field of recordFields) {
    if (!schemaFields.has(field)) {
      throw new Error(`Unknown field: ${field}. Not defined in schema.`);
    }
  }

  // Validate field types
  for (const field of schema) {
    const value = record[field.name];
    validateFieldValue(value, field.type, field.name);
  }
}

/**
 * Validate a field value matches its type
 */
function validateFieldValue(value: unknown, expectedType: FieldType, fieldName: string): void {
  switch (expectedType) {
    case "string":
      if (typeof value !== "string") {
        throw new Error(`Field "${fieldName}" must be a string, got ${typeof value}`);
      }
      break;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new Error(`Field "${fieldName}" must be a number, got ${typeof value}`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`Field "${fieldName}" must be a boolean, got ${typeof value}`);
      }
      break;
    case "date": {
      if (typeof value !== "string") {
        throw new Error(
          `Field "${fieldName}" must be a date string (ISO 8601), got ${typeof value}`
        );
      }
      // Validate ISO 8601 format
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Field "${fieldName}" must be a valid ISO 8601 date string`);
      }
      break;
    }
  }
}

/**
 * Generate a unique ID for records
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current ISO 8601 timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
