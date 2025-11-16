/**
 * Storage provider tests
 * Tests for local storage provider functionality
 */

import { promises as fs } from 'fs';
import path from 'path';
import { LocalStorageProvider } from '../src/storage/local.js';
import { ReviewTypeData } from '../src/types.js';

const TEST_DATA_PATH = './test-data';

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
 * Assert falsiness
 */
function assertFalse(value: any, message?: string) {
  if (value) {
    throw new Error(message || `Expected falsy value, got ${value}`);
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
  console.log('Running Storage Provider Tests\n');

  // Clean up before tests
  await cleanup();

  const storage = new LocalStorageProvider(TEST_DATA_PATH);

  // Test 1: Initialize storage
  await test('should initialize storage and create directories', async () => {
    await storage.initialize();
    const stat = await fs.stat(TEST_DATA_PATH);
    assertTrue(stat.isDirectory(), 'Data directory should exist');
  });

  // Test 2: Write and read a type
  await test('should write and read a review type', async () => {
    const typeData: ReviewTypeData = {
      name: 'coffee',
      schema: [
        { name: 'flavor', type: 'string' },
        { name: 'aroma', type: 'string' },
      ],
      records: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.writeType('coffee', typeData);
    const readData = await storage.readType('coffee');

    assertEquals(readData.name, typeData.name);
    assertEquals(readData.schema.length, 2);
  });

  // Test 3: List types
  await test('should list all types', async () => {
    const types = await storage.listTypes();
    assertTrue(types.includes('coffee'), 'Should include coffee type');
    assertEquals(types.length, 1);
  });

  // Test 4: Check type exists
  await test('should check if type exists', async () => {
    const exists = await storage.typeExists('coffee');
    assertTrue(exists, 'Coffee type should exist');

    const notExists = await storage.typeExists('nonexistent');
    assertFalse(notExists, 'Nonexistent type should not exist');
  });

  // Test 5: Add multiple types
  await test('should handle multiple types', async () => {
    const whiskyData: ReviewTypeData = {
      name: 'whisky',
      schema: [
        { name: 'taste', type: 'string' },
        { name: 'age', type: 'number' },
      ],
      records: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.writeType('whisky', whiskyData);
    const types = await storage.listTypes();
    assertEquals(types.length, 2);
    assertTrue(types.includes('coffee'));
    assertTrue(types.includes('whisky'));
  });

  // Test 6: Add records to a type
  await test('should add records to a type', async () => {
    const coffeeData = await storage.readType('coffee');
    coffeeData.records.push({
      id: '1',
      data: { flavor: 'nutty', aroma: 'strong' },
      createdAt: new Date().toISOString(),
    });
    coffeeData.updatedAt = new Date().toISOString();

    await storage.writeType('coffee', coffeeData);
    const updatedData = await storage.readType('coffee');
    assertEquals(updatedData.records.length, 1);
    assertEquals(updatedData.records[0].data.flavor, 'nutty');
  });

  // Test 7: Delete a type
  await test('should delete a type', async () => {
    await storage.deleteType('whisky');
    const types = await storage.listTypes();
    assertFalse(types.includes('whisky'), 'Whisky should be deleted');
    assertEquals(types.length, 1);
  });

  // Test 8: Error handling - read nonexistent type
  await test('should throw error when reading nonexistent type', async () => {
    await assertThrows(
      () => storage.readType('nonexistent'),
      'Should throw error for nonexistent type'
    );
  });

  // Test 9: Error handling - delete nonexistent type
  await test('should throw error when deleting nonexistent type', async () => {
    await assertThrows(
      () => storage.deleteType('nonexistent'),
      'Should throw error when deleting nonexistent type'
    );
  });

  // Clean up after tests
  await cleanup();

  console.log('\n✓ All storage tests passed!');
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
