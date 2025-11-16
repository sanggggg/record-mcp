# MCP Server Authentication Guide

This guide explains different authentication approaches for your MCP server depending on your use case.

## Understanding MCP Server Types

### 1. Local MCP Server (stdio-based)

**What it is:**
- Runs as a local process on your machine
- Communicates via stdio (standard input/output)
- Used by: Claude Desktop, Cline, other MCP clients

**Authentication:**
- ❌ No authentication needed (runs in your own environment)
- ✅ Security through local process isolation
- ✅ Ideal for personal use

**How to use:**
```json
// Claude Desktop config (~/.config/claude/config.json)
{
  "mcpServers": {
    "record-mcp": {
      "command": "node",
      "args": ["/path/to/record-mcp/dist/index.js"],
      "env": {
        "STORAGE_PROVIDER": "local",
        "LOCAL_DATA_PATH": "/path/to/data"
      }
    }
  }
}
```

**When to use:** Personal projects, local development, Claude Desktop integration

---

### 2. HTTP API (What We Built)

**What it is:**
- Cloudflare Worker exposing MCP tools via HTTP endpoints
- Accessible over the internet
- API key authentication

**Authentication:**
- ✅ API key via HTTP headers
- ✅ Good for remote access
- ⚠️  Requires HTTPS for security
- ⚠️  Not compatible with standard MCP clients (requires custom integration)

**How to use:**
```bash
curl https://your-worker.workers.dev/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_review_types", "arguments": {}}'
```

**When to use:** Remote access, webhooks, custom AI applications, multi-user scenarios

---

### 3. MCP Server with SSE Transport (Advanced)

**What it is:**
- MCP server exposed via Server-Sent Events (SSE) over HTTP
- Follows MCP specification for remote access
- Can include authentication layer

**Authentication options:**
- API keys
- OAuth 2.0
- JWT tokens
- Cloudflare Access

**When to use:** Production deployments, team access, enterprise scenarios

---

## How to Connect Different AI Agents

### Option A: Claude Desktop (Local stdio)

**Best for:** Personal use, local development

**Setup:**
1. Build the local version: `npm run build`
2. Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "record-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/record-mcp/dist/index.js"],
      "env": {
        "STORAGE_PROVIDER": "local"
      }
    }
  }
}
```

**No authentication needed** - runs in your local environment

---

### Option B: Custom AI Application (HTTP API)

**Best for:** Custom bots, integrations, remote access

**Setup:**
1. Deploy to Cloudflare Workers (already done)
2. Set API_KEY secret
3. Make HTTP requests from your AI app

**Example with Python:**
```python
import requests

API_KEY = "your-api-key-here"
WORKER_URL = "https://your-worker.workers.dev/mcp"

def call_mcp_tool(tool_name, arguments):
    response = requests.post(
        WORKER_URL,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "tool": tool_name,
            "arguments": arguments
        }
    )
    return response.json()

# Example usage
result = call_mcp_tool("list_review_types", {})
print(result)
```

**Example with JavaScript:**
```javascript
const API_KEY = "your-api-key-here";
const WORKER_URL = "https://your-worker.workers.dev/mcp";

async function callMcpTool(toolName, args) {
  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tool: toolName,
      arguments: args
    })
  });
  return response.json();
}

// Example usage
const result = await callMcpTool('list_review_types', {});
console.log(result);
```

**Authentication:** Include API key in `Authorization` or `X-API-Key` header

---

### Option C: MCP Client Library (Custom Integration)

**Best for:** Building MCP-compatible applications

**Setup:**
Create a custom MCP client that connects to your HTTP endpoint:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Note: This would require implementing SSE transport on the worker
const transport = new SSEClientTransport(
  new URL('https://your-worker.workers.dev/mcp'),
  {
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  }
);

const client = new Client({
  name: "my-mcp-client",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);
```

**Authentication:** Pass API key in transport headers

---

## Security Recommendations by Use Case

### Local Development (stdio)
✅ No authentication needed
✅ Use local storage
✅ Keep sensitive data local

### Remote Access (HTTP API)
✅ Always use API keys
✅ Use HTTPS only (enforced by Cloudflare)
✅ Rotate keys regularly
✅ Monitor access logs
⚠️  Consider rate limiting
⚠️  Consider IP allowlisting for sensitive data

### Production/Team Use
✅ Use OAuth 2.0 or JWT tokens
✅ Implement user-level permissions
✅ Use Cloudflare Access or similar
✅ Enable audit logging
✅ Set up monitoring and alerts

---

## Improving the Current HTTP API Authentication

### Option 1: Add Multiple API Keys (Simple)

Support multiple API keys for different users/services:

```typescript
// In worker.ts
const VALID_API_KEYS = [
  env.API_KEY_USER_1,
  env.API_KEY_USER_2,
  env.API_KEY_SERVICE,
];

function validateApiKey(request: Request, env: Env): boolean {
  const token = extractToken(request);
  return VALID_API_KEYS.includes(token);
}
```

### Option 2: JWT Tokens (Better)

Use signed JWT tokens with expiration:

```typescript
import { verify } from '@tsndr/cloudflare-worker-jwt';

async function validateJWT(request: Request, env: Env): Promise<boolean> {
  const token = extractToken(request);
  try {
    const isValid = await verify(token, env.JWT_SECRET);
    return isValid;
  } catch {
    return false;
  }
}
```

### Option 3: Cloudflare Access (Best for Teams)

Use Cloudflare Access for enterprise-grade authentication:
- Zero Trust security
- SSO integration
- User management
- Access policies

---

## Frequently Asked Questions

### Q: Can I use this with Claude Desktop?
A: No, the HTTP API is not compatible with Claude Desktop. For Claude Desktop, use the local stdio server (src/index.ts).

### Q: How do I authenticate with the MCP SDK?
A: The MCP SDK uses stdio or SSE transports. Our HTTP API is a simplified wrapper. To use the MCP SDK, you'd need to implement SSE transport.

### Q: Is API key authentication secure enough?
A: For personal/small team use, yes. For production, consider JWT tokens or OAuth 2.0.

### Q: Can multiple AI agents share one API key?
A: Yes, but it's better to use separate keys per agent for tracking and revocation.

### Q: How do I revoke access?
A: Delete the API_KEY secret and create a new one:
```bash
npx wrangler secret delete API_KEY
echo "new-key" | npx wrangler secret put API_KEY
```

---

## Next Steps

1. **For local use:** Use `src/index.ts` with Claude Desktop (no auth needed)
2. **For remote use:** Use the Cloudflare Worker with API keys (current setup)
3. **For production:** Consider implementing JWT or Cloudflare Access
4. **For teams:** Implement per-user API keys or OAuth

Choose the approach that matches your security requirements and use case.
