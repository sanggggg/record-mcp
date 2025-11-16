#!/usr/bin/env node

/**
 * Dynamic Review Record MCP Server
 * Main entry point for the MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { createStorageProvider } from './storage/factory.js';
import { StorageProvider } from './storage/interface.js';
import { listTypes, getType } from './tools/list-types.js';
import { addType } from './tools/add-type.js';
import { addField } from './tools/add-field.js';
import { addRecord } from './tools/add-record.js';

// Initialize storage provider
let storage: StorageProvider;

// Define MCP tools
const TOOLS: Tool[] = [
  {
    name: 'list_review_types',
    description: 'List all review types with their schemas and record counts',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_review_type',
    description: 'Get detailed information about a specific review type including all records',
    inputSchema: {
      type: 'object',
      properties: {
        typeName: {
          type: 'string',
          description: 'Name of the review type to retrieve',
        },
      },
      required: ['typeName'],
    },
  },
  {
    name: 'add_review_type',
    description: 'Create a new review type with a custom schema',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the new review type (e.g., "coffee", "whisky")',
        },
        fields: {
          type: 'array',
          description: 'Array of field definitions for the schema',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Field name',
              },
              type: {
                type: 'string',
                enum: ['string', 'number', 'boolean', 'date'],
                description: 'Field type',
              },
            },
            required: ['name', 'type'],
          },
        },
      },
      required: ['name', 'fields'],
    },
  },
  {
    name: 'add_field_to_type',
    description: 'Add a new field to an existing review type schema',
    inputSchema: {
      type: 'object',
      properties: {
        typeName: {
          type: 'string',
          description: 'Name of the review type to modify',
        },
        fieldName: {
          type: 'string',
          description: 'Name of the new field',
        },
        fieldType: {
          type: 'string',
          enum: ['string', 'number', 'boolean', 'date'],
          description: 'Type of the new field',
        },
      },
      required: ['typeName', 'fieldName', 'fieldType'],
    },
  },
  {
    name: 'add_review_record',
    description: 'Add a new review record to a type',
    inputSchema: {
      type: 'object',
      properties: {
        typeName: {
          type: 'string',
          description: 'Name of the review type',
        },
        data: {
          type: 'object',
          description: 'Review data matching the type schema',
        },
      },
      required: ['typeName', 'data'],
    },
  },
];

/**
 * Create and configure the MCP server
 */
async function main() {
  try {
    // Initialize storage
    storage = createStorageProvider();
    await storage.initialize();

    // Create MCP server
    const server = new Server(
      {
        name: 'record-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Handle list tools request
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    // Handle call tool request
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_review_types': {
            const result = await listTypes(storage);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_review_type': {
            const typeName = args?.typeName as string;
            if (!typeName) {
              throw new Error('typeName is required');
            }
            const result = await getType(storage, typeName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'add_review_type': {
            const params = args as { name: string; fields: Array<{ name: string; type: string }> };
            if (!params?.name || !params?.fields) {
              throw new Error('name and fields are required');
            }
            const result = await addType(storage, params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'add_field_to_type': {
            const params = args as { typeName: string; fieldName: string; fieldType: string };
            if (!params?.typeName || !params?.fieldName || !params?.fieldType) {
              throw new Error('typeName, fieldName, and fieldType are required');
            }
            const result = await addField(storage, params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'add_review_record': {
            const params = args as { typeName: string; data: Record<string, unknown> };
            if (!params?.typeName || !params?.data) {
              throw new Error('typeName and data are required');
            }
            const result = await addRecord(storage, params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Record MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main();
