# Record MCP Server

A Model Context Protocol (MCP) server for storing and managing dynamic review records with user-defined schemas. Perfect for organizing reviews of coffee, whisky, wine, or any other category you can think of!

## Features

- **Dynamic Schemas**: Create review types with custom fields on-the-fly
- **Flexible Storage**: Local filesystem (dev) or Cloudflare R2 (production)
- **Type-Safe**: Built with TypeScript and runtime validation
- **Extensible**: Add new fields to existing review types
- **Easy Migration**: Switch from local to cloud storage with one environment variable

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

For local development (default):

```env
STORAGE_PROVIDER=local
LOCAL_DATA_PATH=./data
```

For production with Cloudflare R2:

```env
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=review-records
```

### Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

### Running Tests

```bash
npm test
```

## Deployment

This project supports automatic deployment to Cloudflare Workers. When you push changes to the `main` branch, the code is automatically deployed.

### Setup Deployment

1. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions
2. Configure required GitHub secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
3. Push to `main` branch to trigger automatic deployment

### Manual Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Or use wrangler directly
npm run cf:deploy
```

For more details, see the [Deployment Guide](./DEPLOYMENT.md).

## MCP Tools

The server provides the following MCP tools:

### 1. `list_review_types`

List all review types with their schemas and record counts.

**Parameters**: None

**Example Response**:
```json
{
  "types": [
    {
      "name": "coffee",
      "schema": [
        { "name": "flavor", "type": "string" },
        { "name": "aroma", "type": "string" },
        { "name": "acidity", "type": "string" }
      ],
      "recordCount": 5,
      "createdAt": "2025-11-16T10:00:00Z",
      "updatedAt": "2025-11-16T12:00:00Z"
    }
  ]
}
```

### 2. `get_review_type`

Get detailed information about a specific review type including all records.

**Parameters**:
- `typeName` (string): Name of the review type

**Example**:
```json
{
  "typeName": "coffee"
}
```

### 3. `add_review_type`

Create a new review type with a custom schema.

**Parameters**:
- `name` (string): Name of the review type (e.g., "coffee", "whisky")
- `fields` (array): Array of field definitions

**Supported Field Types**:
- `string`: Text values
- `number`: Numeric values
- `boolean`: True/false values
- `date`: ISO 8601 date strings

**Example**:
```json
{
  "name": "coffee",
  "fields": [
    { "name": "flavor", "type": "string" },
    { "name": "aroma", "type": "string" },
    { "name": "acidity", "type": "string" },
    { "name": "rating", "type": "number" }
  ]
}
```

### 4. `add_field_to_type`

Add a new field to an existing review type's schema.

**Parameters**:
- `typeName` (string): Name of the review type
- `fieldName` (string): Name of the new field
- `fieldType` (string): Type of the field (string, number, boolean, date)

**Example**:
```json
{
  "typeName": "coffee",
  "fieldName": "body",
  "fieldType": "string"
}
```

### 5. `add_review_record`

Add a new review record to a type.

**Parameters**:
- `typeName` (string): Name of the review type
- `data` (object): Review data matching the type's schema

**Example**:
```json
{
  "typeName": "coffee",
  "data": {
    "flavor": "nutty",
    "aroma": "strong",
    "acidity": "medium",
    "rating": 8.5
  }
}
```

## Usage Examples

### Complete Workflow

```javascript
// 1. Create a new review type
await mcp.callTool("add_review_type", {
  name: "whisky",
  fields: [
    { name: "taste", type: "string" },
    { name: "age", type: "number" },
    { name: "peated", type: "boolean" },
    { name: "tasted_on", type: "date" }
  ]
});

// 2. Add a review
await mcp.callTool("add_review_record", {
  typeName: "whisky",
  data: {
    taste: "smoky and complex",
    age: 12,
    peated: true,
    tasted_on: "2025-11-16T10:00:00Z"
  }
});

// 3. Add more fields later
await mcp.callTool("add_field_to_type", {
  typeName: "whisky",
  fieldName: "region",
  fieldType: "string"
});

// 4. List all types and their data
const result = await mcp.callTool("list_review_types", {});
```

## Architecture

### Project Structure

```
record-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── types.ts              # TypeScript type definitions
│   ├── storage/
│   │   ├── interface.ts      # Storage provider interface
│   │   ├── local.ts          # Local file system storage
│   │   ├── r2.ts             # Cloudflare R2 storage
│   │   └── factory.ts        # Storage provider factory
│   ├── tools/
│   │   ├── list-types.ts     # List and get review types
│   │   ├── add-type.ts       # Create new review type
│   │   ├── add-field.ts      # Add field to type
│   │   └── add-record.ts     # Add review record
│   └── utils/
│       └── validation.ts     # Schema and data validation
├── data/                     # Local storage (when using local provider)
│   ├── types/
│   │   ├── coffee.json
│   │   └── whisky.json
│   └── index.json
└── tests/
    ├── storage.test.ts       # Storage provider tests
    └── tools.test.ts         # MCP tools tests
```

### Storage Abstraction

The server uses a storage abstraction layer that allows easy switching between local files and Cloudflare R2:

- **Local Storage** (Development): Uses Node.js `fs/promises` to store JSON files
- **R2 Storage** (Production): Uses AWS S3-compatible API to store in Cloudflare R2

Both providers implement the same `StorageProvider` interface, making migration seamless.

### Data Format

Each review type is stored as a separate JSON file:

```json
{
  "name": "coffee",
  "schema": [
    { "name": "flavor", "type": "string" },
    { "name": "aroma", "type": "string" }
  ],
  "records": [
    {
      "id": "1234567890-abc123",
      "data": {
        "flavor": "nutty",
        "aroma": "strong"
      },
      "createdAt": "2025-11-16T10:00:00Z"
    }
  ],
  "createdAt": "2025-11-15T09:00:00Z",
  "updatedAt": "2025-11-16T10:00:00Z"
}
```

## Migration from Local to R2

When you're ready to move to production:

1. Set up your Cloudflare R2 bucket
2. Update your `.env` file with R2 credentials
3. Change `STORAGE_PROVIDER=r2`
4. Restart the server

Optional: Use a migration script to copy existing data:

```typescript
// Copy all local files to R2
const localStorage = new LocalStorageProvider('./data');
const r2Storage = new R2StorageProvider(r2Config);

const types = await localStorage.listTypes();
for (const typeName of types) {
  const data = await localStorage.readType(typeName);
  await r2Storage.writeType(typeName, data);
}
```

## Validation

The server provides comprehensive validation:

- **Type Names**: Alphanumeric, hyphens, and underscores only
- **Field Types**: Must be one of: string, number, boolean, date
- **Required Fields**: All schema fields must be present in records
- **Extra Fields**: Records cannot have fields not in the schema
- **Type Checking**: Field values must match their declared types

## Error Handling

All tools return structured error messages:

```json
{
  "error": "Review type \"coffee\" already exists"
}
```

Common errors:
- Duplicate type names
- Duplicate field names
- Missing required fields in records
- Type mismatches
- Invalid type/field names

## Development

### Building

```bash
npm run build
```

### Watching for Changes

```bash
npm run watch
```

### Testing

Run all tests:
```bash
npm test
```

Run specific test file:
```bash
tsx tests/storage.test.ts
tsx tests/tools.test.ts
```

## License

MIT

## Contributing

Contributions welcome! Please ensure tests pass before submitting PRs.

## Support

For issues or questions, please open a GitHub issue.
