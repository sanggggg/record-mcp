/**
 * Example HTTP client for the record-mcp Cloudflare Worker
 * This shows how to integrate the MCP server with custom AI applications
 */

interface McpResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class RecordMcpClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Make an authenticated request to the MCP server
   */
  private async request(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown
  ): Promise<McpResponse> {
    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    return response.json();
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<McpResponse> {
    return this.request('/mcp', 'POST', {
      tool: toolName,
      arguments: args,
    });
  }

  /**
   * List all available tools
   */
  async listTools(): Promise<McpResponse> {
    return this.request('/tools', 'GET');
  }

  /**
   * Health check
   */
  async health(): Promise<McpResponse> {
    return this.request('/health', 'GET');
  }

  // Convenience methods for specific tools

  async listReviewTypes() {
    return this.callTool('list_review_types', {});
  }

  async getReviewType(typeName: string) {
    return this.callTool('get_review_type', { typeName });
  }

  async addReviewType(name: string, fields: Array<{ name: string; type: string }>) {
    return this.callTool('add_review_type', { name, fields });
  }

  async addFieldToType(typeName: string, fieldName: string, fieldType: string) {
    return this.callTool('add_field_to_type', { typeName, fieldName, fieldType });
  }

  async addReviewRecord(typeName: string, data: Record<string, unknown>) {
    return this.callTool('add_review_record', { typeName, data });
  }
}

// Example usage
async function example() {
  const client = new RecordMcpClient(
    'https://your-worker.workers.dev',
    'your-api-key-here'
  );

  // Health check
  const health = await client.health();
  console.log('Health:', health);

  // Create a review type
  const createResult = await client.addReviewType('coffee', [
    { name: 'flavor', type: 'string' },
    { name: 'aroma', type: 'string' },
    { name: 'rating', type: 'number' },
  ]);
  console.log('Created type:', createResult);

  // Add a review
  const reviewResult = await client.addReviewRecord('coffee', {
    flavor: 'nutty',
    aroma: 'strong',
    rating: 8.5,
  });
  console.log('Added review:', reviewResult);

  // List all types
  const types = await client.listReviewTypes();
  console.log('All types:', types);
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example().catch(console.error);
}
