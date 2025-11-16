# Dynamic Review Record MCP Server - Implementation Plan

## Overview
MCP server for storing dynamic review records with user-defined categories and schemas. Supports flexible review types (coffee, whisky, wine, etc.) where both the types and their field structures are defined at runtime by users.

## Architecture

### Storage Strategy
- **Development**: Multiple JSON files (local filesystem)
- **Production**: Cloudflare R2 (future)
- **Design Pattern**: Storage abstraction layer for easy migration

### Project Structure
```
record-mcp/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── types.ts                    # TypeScript types
│   ├── storage/
│   │   ├── interface.ts            # StorageProvider interface
│   │   ├── local.ts                # Local file system (DEV)
│   │   ├── r2.ts                   # Cloudflare R2 (FUTURE)
│   │   └── factory.ts              # Provider selection logic
│   ├── tools/
│   │   ├── list-types.ts           # List all review types
│   │   ├── add-type.ts             # Create new review type
│   │   ├── add-field.ts            # Add field to type
│   │   └── add-record.ts           # Add review record
│   └── utils/
│       └── validation.ts           # Schema validation
├── data/                           # Local storage (dev only)
│   ├── types/
│   │   ├── coffee.json
│   │   ├── whisky.json
│   │   └── wine.json
│   └── index.json                  # Metadata: list of types
├── tests/
│   ├── storage.test.ts             # Storage provider tests
│   └── tools.test.ts               # MCP tools tests
├── .env.example                    # Example configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Data Model

### Storage Interface
```typescript
interface StorageProvider {
  readType(typeName: string): Promise<ReviewTypeData>
  writeType(typeName: string, data: ReviewTypeData): Promise<void>
  listTypes(): Promise<string[]>
  deleteType(typeName: string): Promise<void>
}
```

### File Structure

**data/index.json** - Quick type listing
```json
{
  "types": ["coffee", "whisky", "wine"],
  "lastUpdated": "2025-11-16T10:30:00Z"
}
```

**data/types/coffee.json** - Individual type file
```json
{
  "name": "coffee",
  "schema": [
    { "name": "flavor", "type": "string" },
    { "name": "aroma", "type": "string" },
    { "name": "acidity", "type": "string" }
  ],
  "records": [
    {
      "id": "1",
      "data": {
        "flavor": "nutty",
        "aroma": "strong",
        "acidity": "medium"
      },
      "createdAt": "2025-11-16T10:00:00Z"
    }
  ],
  "createdAt": "2025-11-15T09:00:00Z",
  "updatedAt": "2025-11-16T10:00:00Z"
}
```

## MCP Tools (Endpoints)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_review_types` | List all types + schemas | None |
| `get_review_type` | Get specific type details | `typeName` |
| `add_review_type` | Create new review type | `name`, `fields[]` |
| `add_field_to_type` | Add column to type | `typeName`, `fieldName`, `fieldType` |
| `add_review_record` | Create review entry | `typeName`, `data{}` |
| `list_records` | Get all records for type | `typeName` |

## Configuration (.env)

```bash
# Storage provider: 'local' or 'r2'
STORAGE_PROVIDER=local

# Local storage path (dev)
LOCAL_DATA_PATH=./data

# Cloudflare R2 credentials (prod)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=review-records
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
```

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@aws-sdk/client-s3": "^3.x",
    "@types/node": "^20.x",
    "typescript": "^5.x",
    "tsx": "^4.x"
  }
}
```

## Implementation Phases

### Phase 1: Development (Local Files)
- Use Node.js fs/promises
- Read: `fs.readFile('data/types/coffee.json')`
- Write: `fs.writeFile('data/types/coffee.json')`
- List: `fs.readdir('data/types/')`

### Phase 2: Production (Cloudflare R2)
- Use S3-compatible API
- Read: `s3.getObject({ Bucket, Key: 'types/coffee.json' })`
- Write: `s3.putObject({ Bucket, Key: 'types/coffee.json', Body })`
- List: `s3.listObjectsV2({ Bucket, Prefix: 'types/' })`

## Migration Path (Local → R2)

### Step 1: Develop with local storage
```typescript
const storage = new LocalStorageProvider('./data');
```

### Step 2: Switch to R2
```typescript
const storage = new R2StorageProvider({
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME
});
```

### Step 3: Optional migration script
- Read all files from `./data/types/`
- Upload to R2 bucket
- Verify integrity

## Key Design Decisions

1. **One file per type**: Easy to manage, good R2 fit (object per type)
2. **index.json**: Fast type listing without reading all files
3. **Embedded records**: Records stored inside type file (simpler than separate files)
4. **Atomic writes**: Write to temp file → rename (local) or putObject (R2)
5. **Future-proof**: Same JSON structure works for both local and R2

## Testing Strategy

### Automated Tests
- **Storage Provider Tests**: Verify read/write/list/delete operations
- **Tool Tests**: Test each MCP tool with various inputs
- **Validation Tests**: Ensure schema validation works correctly

### Manual Testing
- Test complete workflow: create type → add fields → add records
- Test error cases: invalid types, missing fields, etc.
- Test with multiple review types simultaneously

## Example Usage Flow

```bash
# 1. Create a new review type
add_review_type("coffee", fields: [
  {name: "flavor", type: "string"},
  {name: "aroma", type: "string"},
  {name: "acidity", type: "string"}
])

# 2. Add a review record
add_review_record("coffee", {
  flavor: "nutty",
  aroma: "strong",
  acidity: "medium"
})

# 3. Add more fields to the type
add_field_to_type("coffee", "body", "string")

# 4. List all types and their schemas
list_review_types()

# 5. Get all records for a type
list_records("coffee")
```

## Benefits

✅ **Simple development**: Just local files, no cloud setup needed
✅ **Easy migration**: Change 1 environment variable to switch to R2
✅ **Cost-effective**: R2 has free tier, cheap storage
✅ **Scalable**: R2 handles millions of objects
✅ **Human-readable**: JSON files easy to inspect/backup
✅ **Version control**: Can commit sample data files
✅ **Fully dynamic**: No hardcoded review types or schemas
✅ **Type-safe**: TypeScript + Zod validation
