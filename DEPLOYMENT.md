# Cloudflare Workers Deployment Guide

This project is configured to automatically deploy to Cloudflare Workers when changes are pushed to the `main` branch.

The deployed worker provides an **HTTP API** for the MCP server with **API key authentication** to prevent unauthorized access.

## Authentication

The worker requires API key authentication via HTTP headers:

- **Authorization header**: `Authorization: Bearer YOUR_API_KEY`
- **X-API-Key header**: `X-API-Key: YOUR_API_KEY`

If `API_KEY` is not configured, the worker will run in **development mode** (authentication disabled) with a warning.

## Required GitHub Secrets

To enable automatic deployment, you need to configure the following secrets in your GitHub repository settings:

### Required Secrets

1. **CLOUDFLARE_API_TOKEN**
   - Description: Cloudflare API token with Workers deployment permissions
   - How to get: Go to Cloudflare Dashboard → My Profile → API Tokens → Create Token
   - Required permissions: `Workers Scripts:Edit`, `Workers Routes:Edit`, `Account Settings:Read`
   - Placeholder value: `your-cloudflare-api-token-here`

2. **CLOUDFLARE_ACCOUNT_ID**
   - Description: Your Cloudflare account ID
   - How to get: Cloudflare Dashboard → Workers & Pages → Overview (shown on right sidebar)
   - Placeholder value: `your-cloudflare-account-id-here`

3. **API_KEY** (Highly Recommended)
   - Description: Secret API key for authenticating requests to your worker
   - How to generate: Use a strong random string (e.g., `openssl rand -hex 32`)
   - Placeholder value: `your-secret-api-key-generate-with-openssl-rand-hex-32`
   - **Security Note**: Keep this secret! Anyone with this key can access your MCP server.

### Optional Secrets (for R2 Storage)

If you're using Cloudflare R2 for storage, you may also need:

3. **R2_ACCESS_KEY_ID**
   - Description: R2 API access key ID
   - How to get: Cloudflare Dashboard → R2 → Manage R2 API Tokens
   - Placeholder value: `your-r2-access-key-id-here`

4. **R2_SECRET_ACCESS_KEY**
   - Description: R2 API secret access key
   - How to get: Generated when creating R2 API token
   - Placeholder value: `your-r2-secret-access-key-here`

## Setting up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to: Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the name and value as described above

## Deployment Workflow

The deployment workflow (`.github/workflows/deploy.yml`) will:

1. Trigger on every push to the `main` branch
2. Checkout the code
3. Install dependencies
4. Build the TypeScript project
5. Deploy to Cloudflare Workers using Wrangler
6. Set the API_KEY secret in the worker environment

## Worker Endpoints

Once deployed, your worker will expose the following HTTP endpoints:

### `GET /` or `GET /health`
Health check endpoint (no authentication required)

```bash
curl https://your-worker.workers.dev/health
```

### `GET /tools`
List available MCP tools (requires authentication)

```bash
curl https://your-worker.workers.dev/tools \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### `POST /mcp`
Call an MCP tool (requires authentication)

```bash
curl https://your-worker.workers.dev/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "list_review_types",
    "arguments": {}
  }'
```

Example with tool arguments:

```bash
curl https://your-worker.workers.dev/mcp \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "add_review_type",
    "arguments": {
      "name": "coffee",
      "fields": [
        {"name": "flavor", "type": "string"},
        {"name": "rating", "type": "number"}
      ]
    }
  }'
```

## Manual Deployment

To deploy manually from your local machine:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to Cloudflare
npm run deploy
```

Make sure you have authenticated with Wrangler first:

```bash
npx wrangler login
```

### Setting API Key Manually

After deployment, set your API key secret:

```bash
# Generate a secure API key
openssl rand -hex 32

# Set it in Cloudflare
echo "your-generated-api-key" | npx wrangler secret put API_KEY
```

Or use an interactive prompt:

```bash
npx wrangler secret put API_KEY
# Then paste your API key when prompted
```

## Local Development

To test your worker locally:

```bash
npm run cf:dev
```

## Configuration

The Cloudflare Worker configuration is in `wrangler.toml`. Key settings:

- **Worker name**: `record-mcp`
- **R2 Bucket binding**: `RECORD_BUCKET` → `record-mcp-data`
- **Node compatibility**: Enabled

## Security Best Practices

1. **Always set API_KEY in production** - Never deploy without authentication
2. **Use strong API keys** - Generate with `openssl rand -hex 32` or similar
3. **Rotate keys regularly** - Update the secret periodically
4. **Use HTTPS only** - Cloudflare Workers enforce HTTPS by default
5. **Keep secrets in GitHub Secrets** - Never commit API keys to git

## Troubleshooting

### Deployment Issues

- **Deployment fails**: Check that your API token has the correct permissions
- **R2 errors**: Ensure the bucket exists and your API credentials are correct
- **Build errors**: Run `npm run build` locally to debug TypeScript compilation issues

### Authentication Issues

- **401 Unauthorized**: Check that you're sending the API key in the correct header format
  - `Authorization: Bearer YOUR_API_KEY` or
  - `X-API-Key: YOUR_API_KEY`
- **API key not working**: Verify the secret is set correctly:
  ```bash
  npx wrangler secret list
  ```
- **Authentication disabled warning**: Set the API_KEY secret (see above)

### Testing Authentication

```bash
# Should fail with 401
curl https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_review_types"}'

# Should succeed
curl https://your-worker.workers.dev/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_review_types"}'
```
