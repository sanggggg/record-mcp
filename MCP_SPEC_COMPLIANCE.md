# MCP Specification Compliance Guide

This document explains the different levels of MCP specification compliance for authentication.

## TL;DR - What You Need

| Use Case | Recommended Approach | File to Use | Spec Compliant? |
|----------|---------------------|-------------|-----------------|
| **Local development (Claude Desktop)** | No auth (stdio) | `src/index.ts` | ✅ Yes |
| **Personal/hobby remote access** | Simple API keys | `src/worker.ts` | ⚠️ Partial |
| **Production MCP server** | OAuth 2.1 | `src/worker-oauth.ts` | ✅ Yes (with auth server) |
| **Enterprise/team** | OAuth 2.1 + Cloudflare Access | `src/worker-oauth.ts` + CF Access | ✅ Yes |

## MCP Specification Requirements

From the [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization):

### What's Required:

1. **Authorization is OPTIONAL** - You don't have to implement it at all
2. **When using HTTP transport**, you **SHOULD** implement authentication
3. **When implementing auth**, you **SHOULD** use OAuth 2.1
4. **Origin validation** - MUST validate Origin headers (prevent DNS rebinding)
5. **HTTPS only** - All endpoints MUST use HTTPS

### OAuth 2.1 Requirements (when implementing auth):

If you implement authorization, the spec requires:

✅ **RFC9728 - Protected Resource Metadata**
- Endpoint: `/.well-known/oauth-protected-resource`
- Describes authorization servers and supported methods

✅ **RFC8414 - Authorization Server Metadata**
- Endpoint: `/.well-known/oauth-authorization-server`
- Describes OAuth endpoints and capabilities

✅ **PKCE Support** - `code_challenge_methods_supported`

✅ **Bearer Token Authentication**
- Format: `Authorization: Bearer <access-token>`
- MUST return 401 with WWW-Authenticate header on failure

✅ **Token Validation**
- Verify tokens were issued for this resource
- Check expiration
- Validate signature

---

## Implementation Comparison

### Option 1: No Authentication (stdio only)

**File**: `src/index.ts`

**Spec Compliance**: ✅ **Fully compliant**

**Use Case**:
- Claude Desktop integration
- Local development
- Personal use

**Pros**:
- Simple
- No configuration needed
- Most secure for local use (process isolation)

**Cons**:
- Can't be accessed remotely
- Not suitable for APIs

**Configuration**:
```json
// ~/.config/claude/config.json
{
  "mcpServers": {
    "record-mcp": {
      "command": "node",
      "args": ["/path/to/record-mcp/dist/index.js"]
    }
  }
}
```

---

### Option 2: Simple API Key (HTTP)

**File**: `src/worker.ts` (current implementation)

**Spec Compliance**: ⚠️ **Partially compliant**

**What's Compliant**:
- ✅ HTTPS enforced (Cloudflare)
- ✅ Bearer token format supported
- ✅ Optional authentication (as per spec)

**What's Missing**:
- ❌ Origin header validation
- ❌ Protected Resource Metadata (RFC9728)
- ❌ Authorization Server Metadata (RFC8414)
- ❌ Proper OAuth 2.1 token structure
- ❌ WWW-Authenticate header on 401

**Use Case**:
- Personal projects
- Hobby APIs
- Internal tools
- Prototypes

**Pros**:
- Simple to set up
- Easy to understand
- Works with any HTTP client
- Good enough for most non-production use

**Cons**:
- Not fully spec-compliant
- No token expiration
- No refresh tokens
- No scope-based access control

**Configuration**:
```bash
# Generate API key
openssl rand -hex 32

# Set in Cloudflare
echo "your-key" | npx wrangler secret put API_KEY
```

---

### Option 3: OAuth 2.1 Compliant (HTTP)

**File**: `src/worker-oauth.ts` (new implementation)

**Spec Compliance**: ✅ **Fully compliant** (when paired with auth server)

**What's Implemented**:
- ✅ Origin header validation (DNS rebinding protection)
- ✅ Protected Resource Metadata (RFC9728)
- ✅ Authorization Server Metadata (RFC8414)
- ✅ Bearer token validation
- ✅ WWW-Authenticate header on 401
- ✅ Scope support
- ✅ JWT token validation
- ✅ HTTPS enforcement

**Use Case**:
- Production deployments
- Team/multi-user access
- Enterprise applications
- Public APIs

**Pros**:
- Fully spec-compliant
- Token expiration support
- Scope-based access control
- Refresh tokens (when using auth server)
- Integrates with standard OAuth providers

**Cons**:
- More complex setup
- Requires OAuth authorization server
- Requires JWT signing/validation

**Configuration Options**:

#### Option 3A: With External Auth Server (Recommended)

Use a standard OAuth provider:

```bash
# Example with Auth0, Cloudflare Access, or similar
OAUTH_ISSUER=https://your-domain.auth0.com
JWT_SECRET=your-jwt-secret

# The auth server handles:
# - User login
# - Token issuance
# - Token refresh
# - Token revocation
```

Supported OAuth providers:
- **Cloudflare Access** (Zero Trust, built-in)
- **Auth0** (Full-featured OAuth platform)
- **Okta** (Enterprise SSO)
- **Keycloak** (Self-hosted)
- **AWS Cognito** (AWS ecosystem)

#### Option 3B: Simple JWT Tokens (Development)

For development/testing without a full auth server:

```bash
# Use API keys but with JWT format
# The worker validates JWT structure but accepts any valid token
JWT_SECRET=your-secret-for-signing
```

---

## Choosing the Right Implementation

### Decision Tree:

```
Are you using Claude Desktop locally?
├─ Yes → Use src/index.ts (stdio, no auth)
└─ No → Do you need remote access?
    ├─ No → Use src/index.ts (stdio, no auth)
    └─ Yes → Is this for production?
        ├─ No → Use src/worker.ts (simple API keys)
        └─ Yes → Do you need team/multi-user access?
            ├─ No → Use src/worker.ts (simple API keys)
            └─ Yes → Use src/worker-oauth.ts with OAuth provider
```

### Specific Recommendations:

**Use `src/index.ts` (stdio) if**:
- Using Claude Desktop
- Local development only
- Personal use
- Maximum security needed

**Use `src/worker.ts` (simple API keys) if**:
- Need remote access
- Personal or small team (< 5 users)
- Don't need token expiration
- Want simplicity
- Internal tools

**Use `src/worker-oauth.ts` (OAuth 2.1) if**:
- Production deployment
- Team/multi-user access
- Need token expiration
- Need scope-based permissions
- Enterprise requirements
- Want full MCP spec compliance
- Public API

---

## Migration Path

### Current State → Spec Compliant:

If you want to move from simple API keys to full OAuth 2.1 compliance:

**Step 1**: Choose an OAuth provider
```bash
# Options:
# - Cloudflare Access (easiest for CF Workers)
# - Auth0 (full-featured)
# - Self-hosted Keycloak
```

**Step 2**: Update wrangler.toml
```toml
name = "record-mcp"
main = "dist/worker-oauth.js"  # Change from worker.js
```

**Step 3**: Set OAuth environment variables
```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put OAUTH_ISSUER
```

**Step 4**: Update clients to use OAuth tokens
```python
# Before (API key)
headers = {"Authorization": "Bearer simple-api-key"}

# After (OAuth token)
token = get_oauth_token(client_id, client_secret)
headers = {"Authorization": f"Bearer {token}"}
```

---

## Testing Spec Compliance

### Test Origin Validation (DNS Rebinding Protection):

```bash
# Should be rejected
curl -H "Origin: http://evil.com" \
  https://your-worker.workers.dev/mcp

# Should be accepted
curl -H "Origin: https://your-worker.workers.dev" \
  https://your-worker.workers.dev/mcp
```

### Test OAuth Metadata Endpoints:

```bash
# Protected Resource Metadata (RFC9728)
curl https://your-worker.workers.dev/.well-known/oauth-protected-resource

# Authorization Server Metadata (RFC8414)
curl https://your-worker.workers.dev/.well-known/oauth-authorization-server
```

### Test WWW-Authenticate Header:

```bash
# Should return 401 with WWW-Authenticate header
curl -i https://your-worker.workers.dev/mcp

# Response should include:
# HTTP/1.1 401 Unauthorized
# WWW-Authenticate: Bearer realm="record-mcp", scope="mcp:tools"
```

---

## Recommendation for Your Project

Based on the MCP spec, here's my recommendation:

### Short Term (Now):
Keep `src/worker.ts` (simple API keys) because:
- ✅ OAuth is optional in the spec
- ✅ Good enough for personal/small team use
- ✅ Simple and maintainable
- ✅ Works with all HTTP clients

**Add these quick fixes for better compliance**:
1. Add Origin header validation
2. Add WWW-Authenticate header to 401 responses
3. Document that it's not fully OAuth 2.1 compliant

### Long Term (If Needed):
Upgrade to `src/worker-oauth.ts` when:
- You have multiple users
- You need token expiration
- You want full spec compliance
- You're building a public API

**Easiest path**: Use Cloudflare Access
- Zero-config OAuth 2.1
- Built into Cloudflare
- No additional servers needed
- SSO support

---

## Implementing Cloudflare Access (Easiest OAuth Path)

If you want full OAuth 2.1 compliance without managing an auth server:

**Step 1**: Enable Cloudflare Access
```bash
# In Cloudflare Dashboard:
# Zero Trust → Access → Applications → Add Application
```

**Step 2**: Configure Access Policy
```bash
# Create policy allowing specific users/emails
# Cloudflare handles all OAuth flows automatically
```

**Step 3**: Update worker (optional)
```bash
# Cloudflare Access validates tokens before they reach your worker
# Your worker can trust the request is authenticated
# Access user info via CF-Access-Authenticated-User-Email header
```

**Benefits**:
- ✅ Full OAuth 2.1 compliance
- ✅ No code changes needed
- ✅ SSO support (Google, GitHub, etc.)
- ✅ Managed by Cloudflare
- ✅ Zero maintenance

---

## Conclusion

**The MCP spec does mention OAuth 2.1, but it's optional.** Your current implementation is practical and sufficient for most use cases.

**For full spec compliance**, use:
- `src/worker-oauth.ts` + Cloudflare Access (easiest)
- `src/worker-oauth.ts` + Auth0 (most features)
- `src/worker-oauth.ts` + self-hosted Keycloak (most control)

**For most users**, the simple API key approach is fine:
- It's explicitly allowed by the spec ("authorization is optional")
- It's easier to set up and maintain
- It works well for personal/small team use
- You can always upgrade later

Choose based on your actual needs, not just spec compliance.
