# OAuth 2.1 Setup Guide

You've switched to the OAuth 2.1 compliant MCP server implementation! This guide will help you complete the setup.

## Quick Start Options

Choose one of these approaches based on your needs:

### Option 1: Cloudflare Access (Easiest) ⭐ RECOMMENDED

**Best for**: Teams, SSO, Zero-Trust security, no additional infrastructure

**Setup Time**: 5 minutes

**Steps**:

1. **Enable Cloudflare Access** (in Cloudflare Dashboard):
   ```
   Zero Trust → Access → Applications → Add an application
   - Type: Self-hosted
   - Application name: record-mcp
   - Domain: your-worker.workers.dev
   ```

2. **Create Access Policy**:
   ```
   Policy name: MCP Access
   Action: Allow
   Include: Emails ending in @yourdomain.com (or specific users)
   ```

3. **Deploy** (Access handles everything):
   ```bash
   npm run build
   npm run deploy
   ```

4. **Done!** Access now handles:
   - ✅ OAuth 2.1 flows
   - ✅ Token issuance
   - ✅ User authentication
   - ✅ SSO (Google, GitHub, etc.)

**How it works**: Cloudflare Access validates users before requests reach your worker. Your worker receives pre-authenticated requests with user info in headers.

**Cost**: Free for up to 50 users

---

### Option 2: Auth0 (Full-Featured)

**Best for**: Need custom OAuth flows, advanced features, or multi-tenant apps

**Setup Time**: 15 minutes

**Steps**:

1. **Create Auth0 Account** (free): https://auth0.com

2. **Create API in Auth0**:
   ```
   Applications → APIs → Create API
   Name: record-mcp
   Identifier: https://your-worker.workers.dev
   Signing Algorithm: RS256
   ```

3. **Create Application**:
   ```
   Applications → Create Application
   Type: Machine to Machine
   Authorize API: record-mcp
   Scopes: mcp:tools, mcp:read, mcp:write
   ```

4. **Get Credentials**:
   ```
   Domain: your-tenant.auth0.com
   Client ID: <from Auth0>
   Client Secret: <from Auth0>
   ```

5. **Set Secrets**:
   ```bash
   # Your Auth0 domain
   echo "https://your-tenant.auth0.com" | npx wrangler secret put OAUTH_ISSUER

   # JWT secret (from Auth0 Application settings)
   echo "your-jwt-secret" | npx wrangler secret put JWT_SECRET
   ```

6. **Update wrangler.toml**:
   ```toml
   [vars]
   OAUTH_ISSUER = "https://your-tenant.auth0.com"
   ```

7. **Deploy**:
   ```bash
   npm run build
   npm run deploy
   ```

**Getting Tokens** (for clients):
```bash
# Get access token from Auth0
curl --request POST \
  --url https://your-tenant.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id":"YOUR_CLIENT_ID",
    "client_secret":"YOUR_CLIENT_SECRET",
    "audience":"https://your-worker.workers.dev",
    "grant_type":"client_credentials"
  }'
```

**Use token with your worker**:
```bash
curl https://your-worker.workers.dev/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_review_types"}'
```

---

### Option 3: Simple JWT (Development/Testing)

**Best for**: Testing OAuth flows without external auth server

**Setup Time**: 2 minutes

**Steps**:

1. **Generate JWT Secret**:
   ```bash
   openssl rand -hex 32
   ```

2. **Set Secrets**:
   ```bash
   echo "your-generated-secret" | npx wrangler secret put JWT_SECRET
   echo "https://your-worker.workers.dev" | npx wrangler secret put OAUTH_ISSUER
   ```

3. **Deploy**:
   ```bash
   npm run build
   npm run deploy
   ```

4. **Create JWT Tokens** (manually for testing):
   ```javascript
   // Use https://jwt.io to create tokens
   // Header:
   {
     "alg": "HS256",
     "typ": "JWT"
   }

   // Payload:
   {
     "sub": "user-id",
     "iat": Math.floor(Date.now() / 1000),
     "exp": Math.floor(Date.now() / 1000) + 3600, // 1 hour
     "scope": "mcp:tools"
   }

   // Sign with your JWT_SECRET
   ```

5. **Use token**:
   ```bash
   curl https://your-worker.workers.dev/mcp \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"tool": "list_review_types"}'
   ```

**Note**: This is for development only. In production, use a proper auth server.

---

### Option 4: Keep Simple API Keys (Fallback)

The OAuth worker still supports simple API keys as a fallback:

```bash
echo "your-api-key" | npx wrangler secret put API_KEY
```

Then use:
```bash
curl https://your-worker.workers.dev/mcp \
  -H "Authorization: Bearer your-api-key" \
  -d '{"tool": "list_review_types"}'
```

**Note**: This is not OAuth 2.1 compliant but works if you don't set JWT_SECRET.

---

## OAuth 2.1 Endpoints

Your worker now exposes these OAuth metadata endpoints:

### Protected Resource Metadata (RFC9728)
```bash
curl https://your-worker.workers.dev/.well-known/oauth-protected-resource
```

Response:
```json
{
  "resource": "https://your-worker.workers.dev",
  "authorization_servers": ["https://your-worker.workers.dev"],
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["mcp:tools", "mcp:read", "mcp:write"]
}
```

### Authorization Server Metadata (RFC8414)
```bash
curl https://your-worker.workers.dev/.well-known/oauth-authorization-server
```

Response:
```json
{
  "issuer": "https://your-worker.workers.dev",
  "authorization_endpoint": "https://your-worker.workers.dev/oauth/authorize",
  "token_endpoint": "https://your-worker.workers.dev/oauth/token",
  "scopes_supported": ["mcp:tools", "mcp:read", "mcp:write"],
  "code_challenge_methods_supported": ["S256"]
}
```

---

## GitHub Actions Setup

Update your GitHub secrets for OAuth 2.1:

```bash
# In GitHub: Settings → Secrets and variables → Actions

# Required:
CLOUDFLARE_API_TOKEN=<your-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>

# OAuth secrets (choose one approach):

# For Auth0:
JWT_SECRET=<from-auth0>
OAUTH_ISSUER=https://your-tenant.auth0.com

# For simple JWT:
JWT_SECRET=<random-secret>
OAUTH_ISSUER=https://your-worker.workers.dev

# For Cloudflare Access:
# (no secrets needed, Access handles everything)
```

---

## Testing OAuth Compliance

### Test WWW-Authenticate Header:
```bash
curl -i https://your-worker.workers.dev/mcp
# Should return:
# HTTP/1.1 401 Unauthorized
# WWW-Authenticate: Bearer realm="record-mcp", scope="mcp:tools"
```

### Test Origin Validation:
```bash
curl -H "Origin: http://evil.com" https://your-worker.workers.dev/mcp
# Should return 403 Forbidden
```

### Test Health Check (Public):
```bash
curl https://your-worker.workers.dev/health
# Should return 200 OK (no auth required)
```

### Test Authenticated Request:
```bash
curl https://your-worker.workers.dev/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_review_types", "arguments": {}}'
# Should return 200 OK with data
```

---

## Client Integration

### Python with Auth0:
```python
import requests

# Get token from Auth0
token_response = requests.post(
    'https://your-tenant.auth0.com/oauth/token',
    json={
        'client_id': 'YOUR_CLIENT_ID',
        'client_secret': 'YOUR_CLIENT_SECRET',
        'audience': 'https://your-worker.workers.dev',
        'grant_type': 'client_credentials'
    }
)
access_token = token_response.json()['access_token']

# Use token with MCP server
response = requests.post(
    'https://your-worker.workers.dev/mcp',
    headers={'Authorization': f'Bearer {access_token}'},
    json={'tool': 'list_review_types', 'arguments': {}}
)
print(response.json())
```

### JavaScript/TypeScript:
```typescript
// Get token from Auth0
const tokenResponse = await fetch('https://your-tenant.auth0.com/oauth/token', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    audience: 'https://your-worker.workers.dev',
    grant_type: 'client_credentials'
  })
});
const { access_token } = await tokenResponse.json();

// Use token with MCP server
const response = await fetch('https://your-worker.workers.dev/mcp', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tool: 'list_review_types',
    arguments: {}
  })
});
const data = await response.json();
console.log(data);
```

---

## Comparison: Auth Providers

| Feature | Cloudflare Access | Auth0 | Simple JWT |
|---------|------------------|-------|------------|
| **Setup** | Easiest | Medium | Easy |
| **Cost** | Free (50 users) | Free (7k users) | Free |
| **SSO** | ✅ Yes | ✅ Yes | ❌ No |
| **User Management** | ✅ Yes | ✅ Yes | ❌ Manual |
| **Token Refresh** | ✅ Auto | ✅ Yes | ❌ No |
| **Compliance** | ✅ Full | ✅ Full | ⚠️ Partial |
| **Infrastructure** | None | None | None |
| **Best For** | Teams | Apps | Testing |

---

## Next Steps

1. **Choose an approach** (Cloudflare Access recommended)
2. **Complete setup** (follow steps above)
3. **Deploy** to Cloudflare Workers
4. **Test endpoints** to verify OAuth compliance
5. **Update clients** to use OAuth tokens

---

## Troubleshooting

### 401 Unauthorized
- Check token is valid and not expired
- Verify `Authorization: Bearer <token>` header format
- Check token was issued for correct audience

### 403 Origin Error
- Verify Origin header matches your domain
- For local testing, use `localhost` or remove Origin header
- Check CORS settings if calling from browser

### OAuth Metadata Not Found
- Verify `OAUTH_ISSUER` is set correctly
- Check deployment used `worker-oauth.js` not `worker.js`
- Ensure build completed successfully

### Token Validation Fails
- Verify `JWT_SECRET` matches signing secret
- Check token hasn't expired
- Ensure token signature is valid

---

## Rollback to Simple API Keys

If you need to rollback:

1. Update `wrangler.toml`:
   ```toml
   main = "dist/worker.js"
   ```

2. Set API_KEY:
   ```bash
   echo "your-api-key" | npx wrangler secret put API_KEY
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

---

## Questions?

- **MCP Spec**: See [MCP_SPEC_COMPLIANCE.md](./MCP_SPEC_COMPLIANCE.md)
- **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Authentication**: See [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)
