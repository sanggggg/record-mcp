/**
 * Integration test - Complete workflow demonstration
 * This test demonstrates a realistic usage scenario of the MCP server
 */

import { promises as fs } from "node:fs";
import { LocalStorageProvider } from "../src/storage/local.js";
import { addField } from "../src/tools/add-field.js";
import { addRecord } from "../src/tools/add-record.js";
import { addType } from "../src/tools/add-type.js";
import { getType, listTypes } from "../src/tools/list-types.js";

const TEST_DATA_PATH = "./test-data-integration";

async function cleanup() {
  try {
    await fs.rm(TEST_DATA_PATH, { recursive: true, force: true });
  } catch (_error) {
    // Ignore errors
  }
}

async function runIntegrationTest() {
  console.log("=".repeat(60));
  console.log("MCP Server Integration Test - Complete Workflow");
  console.log("=".repeat(60));
  console.log();

  await cleanup();

  const storage = new LocalStorageProvider(TEST_DATA_PATH);
  await storage.initialize();

  console.log("Step 1: Create a Coffee review type");
  console.log("-".repeat(60));
  const coffeeType = await addType(storage, {
    name: "coffee",
    fields: [
      { name: "flavor", type: "string" },
      { name: "aroma", type: "string" },
      { name: "acidity", type: "string" },
      { name: "rating", type: "number" },
    ],
  });
  console.log("Result:", JSON.stringify(coffeeType, null, 2));
  console.log();

  console.log("Step 2: Add coffee reviews");
  console.log("-".repeat(60));

  const review1 = await addRecord(storage, {
    typeName: "coffee",
    data: {
      flavor: "nutty with chocolate notes",
      aroma: "strong and inviting",
      acidity: "medium",
      rating: 8.5,
    },
  });
  console.log("Review 1:", JSON.stringify(review1, null, 2));

  const review2 = await addRecord(storage, {
    typeName: "coffee",
    data: {
      flavor: "fruity and bright",
      aroma: "floral and delicate",
      acidity: "high",
      rating: 9.0,
    },
  });
  console.log("Review 2:", JSON.stringify(review2, null, 2));
  console.log();

  console.log("Step 3: Add a new field to the coffee type");
  console.log("-".repeat(60));
  const addedField = await addField(storage, {
    typeName: "coffee",
    fieldName: "origin",
    fieldType: "string",
  });
  console.log("Result:", JSON.stringify(addedField, null, 2));
  console.log();

  console.log("Step 4: Add another review with the new field");
  console.log("-".repeat(60));
  const review3 = await addRecord(storage, {
    typeName: "coffee",
    data: {
      flavor: "earthy and bold",
      aroma: "intense and smoky",
      acidity: "low",
      rating: 7.5,
      origin: "Colombia",
    },
  });
  console.log("Review 3:", JSON.stringify(review3, null, 2));
  console.log();

  console.log("Step 5: Create a Whisky review type");
  console.log("-".repeat(60));
  const whiskyType = await addType(storage, {
    name: "whisky",
    fields: [
      { name: "taste", type: "string" },
      { name: "age", type: "number" },
      { name: "peated", type: "boolean" },
      { name: "region", type: "string" },
    ],
  });
  console.log("Result:", JSON.stringify(whiskyType, null, 2));
  console.log();

  console.log("Step 6: Add whisky reviews");
  console.log("-".repeat(60));

  const whiskyReview1 = await addRecord(storage, {
    typeName: "whisky",
    data: {
      taste: "smoky and complex",
      age: 12,
      peated: true,
      region: "Islay",
    },
  });
  console.log("Whisky Review 1:", JSON.stringify(whiskyReview1, null, 2));

  const whiskyReview2 = await addRecord(storage, {
    typeName: "whisky",
    data: {
      taste: "smooth and sweet",
      age: 18,
      peated: false,
      region: "Speyside",
    },
  });
  console.log("Whisky Review 2:", JSON.stringify(whiskyReview2, null, 2));
  console.log();

  console.log("Step 7: List all review types");
  console.log("-".repeat(60));
  const allTypes = await listTypes(storage);
  console.log("All Types:", JSON.stringify(allTypes, null, 2));
  console.log();

  console.log("Step 8: Get detailed coffee type data");
  console.log("-".repeat(60));
  const coffeeDetails = await getType(storage, "coffee");
  console.log("Coffee Type Details:", JSON.stringify(coffeeDetails, null, 2));
  console.log();

  console.log("Step 9: Get detailed whisky type data");
  console.log("-".repeat(60));
  const whiskyDetails = await getType(storage, "whisky");
  console.log("Whisky Type Details:", JSON.stringify(whiskyDetails, null, 2));
  console.log();

  console.log("=".repeat(60));
  console.log("Summary:");
  console.log("-".repeat(60));
  console.log(`- Created ${allTypes.types.length} review types`);
  console.log(
    `- Coffee: ${coffeeDetails.recordCount} reviews with ${coffeeDetails.schema.length} fields`
  );
  console.log(
    `- Whisky: ${whiskyDetails.recordCount} reviews with ${whiskyDetails.schema.length} fields`
  );
  console.log("=".repeat(60));
  console.log();
  console.log("✓ Integration test completed successfully!");
  console.log();

  await cleanup();
}

runIntegrationTest().catch((error) => {
  console.error("Integration test failed:", error);
  process.exit(1);
});
