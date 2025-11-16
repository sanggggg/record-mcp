/**
 * Tools tests
 * Tests for MCP tool functionality
 */

import { promises as fs } from 'fs';
import { LocalStorageProvider } from '../src/storage/local.js';
import { listTypes, getType } from '../src/tools/list-types.js';
import { addType } from '../src/tools/add-type.js';
import { addField } from '../src/tools/add-field.js';
import { addRecord } from '../src/tools/add-record.js';

const TEST_DATA_PATH = './test-data-tools';

/**
 * Clean up test data directory
 */
async function cleanup() {
  try {
    await fs.rm(TEST_DATA_PATH, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Run a test with name and assertion
 */
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Assert equality
 */
function assertEquals(actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Expected ${expectedStr}, got ${actualStr}`
    );
  }
}

/**
 * Assert truthiness
 */
function assertTrue(value: any, message?: string) {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${value}`);
  }
}

/**
 * Assert that a function throws
 */
async function assertThrows(fn: () => Promise<any>, message?: string) {
  try {
    await fn();
    throw new Error(message || 'Expected function to throw, but it did not');
  } catch (error) {
    // Expected to throw
    if (error instanceof Error && error.message.includes('Expected function to throw')) {
      throw error;
    }
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('Running Tools Tests\n');

  // Clean up before tests
  await cleanup();

  const storage = new LocalStorageProvider(TEST_DATA_PATH);
  await storage.initialize();

  // Test 1: Add a new review type
  await test('should add a new review type', async () => {
    const result = await addType(storage, {
      name: 'coffee',
      fields: [
        { name: 'flavor', type: 'string' },
        { name: 'aroma', type: 'string' },
        { name: 'acidity', type: 'string' },
      ],
    });

    assertTrue(result.success);
    assertEquals(result.typeName, 'coffee');
  });

  // Test 2: List review types
  await test('should list review types', async () => {
    const result = await listTypes(storage);
    assertEquals(result.types.length, 1);
    assertEquals(result.types[0].name, 'coffee');
    assertEquals(result.types[0].schema.length, 3);
    assertEquals(result.types[0].recordCount, 0);
  });

  // Test 3: Get specific review type
  await test('should get specific review type', async () => {
    const result = await getType(storage, 'coffee');
    assertEquals(result.name, 'coffee');
    assertEquals(result.schema.length, 3);
    assertEquals(result.recordCount, 0);
  });

  // Test 4: Add field to existing type
  await test('should add field to existing type', async () => {
    const result = await addField(storage, {
      typeName: 'coffee',
      fieldName: 'body',
      fieldType: 'string',
    });

    assertTrue(result.success);
    assertEquals(result.fieldName, 'body');

    const typeData = await getType(storage, 'coffee');
    assertEquals(typeData.schema.length, 4);
  });

  // Test 5: Add review record
  await test('should add review record', async () => {
    const result = await addRecord(storage, {
      typeName: 'coffee',
      data: {
        flavor: 'nutty',
        aroma: 'strong',
        acidity: 'medium',
        body: 'full',
      },
    });

    assertTrue(result.success);
    assertEquals(result.typeName, 'coffee');
    assertTrue(result.recordId.length > 0);

    const typeData = await getType(storage, 'coffee');
    assertEquals(typeData.recordCount, 1);
    assertEquals(typeData.records[0].data.flavor, 'nutty');
  });

  // Test 6: Add multiple records
  await test('should add multiple records', async () => {
    await addRecord(storage, {
      typeName: 'coffee',
      data: {
        flavor: 'chocolate',
        aroma: 'mild',
        acidity: 'low',
        body: 'medium',
      },
    });

    await addRecord(storage, {
      typeName: 'coffee',
      data: {
        flavor: 'fruity',
        aroma: 'intense',
        acidity: 'high',
        body: 'light',
      },
    });

    const typeData = await getType(storage, 'coffee');
    assertEquals(typeData.recordCount, 3);
  });

  // Test 7: Add another review type
  await test('should add another review type', async () => {
    const result = await addType(storage, {
      name: 'whisky',
      fields: [
        { name: 'taste', type: 'string' },
        { name: 'age', type: 'number' },
        { name: 'peated', type: 'boolean' },
      ],
    });

    assertTrue(result.success);

    const allTypes = await listTypes(storage);
    assertEquals(allTypes.types.length, 2);
  });

  // Test 8: Add record with different field types
  await test('should handle different field types', async () => {
    const result = await addRecord(storage, {
      typeName: 'whisky',
      data: {
        taste: 'smoky',
        age: 12,
        peated: true,
      },
    });

    assertTrue(result.success);

    const typeData = await getType(storage, 'whisky');
    assertEquals(typeData.records[0].data.age, 12);
    assertEquals(typeData.records[0].data.peated, true);
  });

  // Test 9: Error handling - duplicate type name
  await test('should prevent duplicate type names', async () => {
    await assertThrows(
      () =>
        addType(storage, {
          name: 'coffee',
          fields: [{ name: 'test', type: 'string' }],
        }),
      'Should throw error for duplicate type name'
    );
  });

  // Test 10: Error handling - duplicate field name
  await test('should prevent duplicate field names', async () => {
    await assertThrows(
      () =>
        addField(storage, {
          typeName: 'coffee',
          fieldName: 'flavor',
          fieldType: 'string',
        }),
      'Should throw error for duplicate field name'
    );
  });

  // Test 11: Error handling - missing required field in record
  await test('should validate required fields in record', async () => {
    await assertThrows(
      () =>
        addRecord(storage, {
          typeName: 'coffee',
          data: {
            flavor: 'test',
            // Missing aroma, acidity, body
          },
        }),
      'Should throw error for missing required fields'
    );
  });

  // Test 12: Error handling - extra field in record
  await test('should reject extra fields in record', async () => {
    await assertThrows(
      () =>
        addRecord(storage, {
          typeName: 'coffee',
          data: {
            flavor: 'test',
            aroma: 'test',
            acidity: 'test',
            body: 'test',
            extraField: 'not allowed',
          },
        }),
      'Should throw error for extra fields'
    );
  });

  // Test 13: Error handling - wrong field type
  await test('should validate field types in record', async () => {
    await assertThrows(
      () =>
        addRecord(storage, {
          typeName: 'whisky',
          data: {
            taste: 'smoky',
            age: 'twelve', // Should be number
            peated: true,
          },
        }),
      'Should throw error for wrong field type'
    );
  });

  // Test 14: Validate type name format
  await test('should validate type name format', async () => {
    await assertThrows(
      () =>
        addType(storage, {
          name: 'invalid type!',
          fields: [{ name: 'test', type: 'string' }],
        }),
      'Should throw error for invalid type name'
    );
  });

  // Clean up after tests
  await cleanup();

  console.log('\n✓ All tools tests passed!');
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
