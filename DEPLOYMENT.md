# Cloudflare Workers Deployment Guide

This project is configured to automatically deploy to Cloudflare Workers when changes are pushed to the `main` branch.

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

## Troubleshooting

- **Deployment fails**: Check that your API token has the correct permissions
- **R2 errors**: Ensure the bucket exists and your API credentials are correct
- **Build errors**: Run `npm run build` locally to debug TypeScript compilation issues
