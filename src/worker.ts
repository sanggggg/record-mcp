/**
 * Cloudflare Worker Entry Point
 * HTTP handler for the MCP server with authentication
 */

import { createStorageProvider } from "./storage/factory.js";
import type { StorageProvider } from "./storage/interface.js";
import { addField } from "./tools/add-field.js";
import { addRecord } from "./tools/add-record.js";
import { addType } from "./tools/add-type.js";
import { getType, listTypes } from "./tools/list-types.js";

export interface Env {
	// Cloudflare Worker environment bindings
	RECORD_BUCKET?: R2Bucket;
	API_KEY?: string;
	NODE_ENV?: string;

	// R2 credentials (if needed)
	R2_ACCOUNT_ID?: string;
	R2_ACCESS_KEY_ID?: string;
	R2_SECRET_ACCESS_KEY?: string;
	R2_BUCKET_NAME?: string;
	R2_ENDPOINT?: string;
}

// Storage provider instance
let storage: StorageProvider | null = null;

/**
 * Validate API key from request headers
 */
function validateApiKey(request: Request, env: Env): boolean {
	// If no API_KEY is configured, allow all requests (development mode)
	if (!env.API_KEY) {
		console.warn("⚠️  API_KEY not configured - authentication disabled");
		return true;
	}

	// Check Authorization header (Bearer token)
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.substring(7);
		return token === env.API_KEY;
	}

	// Check X-API-Key header
	const apiKeyHeader = request.headers.get("X-API-Key");
	if (apiKeyHeader) {
		return apiKeyHeader === env.API_KEY;
	}

	return false;
}

/**
 * Handle MCP tool calls via HTTP
 */
async function handleToolCall(
	toolName: string,
	args: Record<string, unknown>,
	storage: StorageProvider
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	try {
		switch (toolName) {
			case "list_review_types": {
				const result = await listTypes(storage);
				return { success: true, data: result };
			}

			case "get_review_type": {
				const typeName = args.typeName as string;
				if (!typeName) {
					return { success: false, error: "typeName is required" };
				}
				const result = await getType(storage, typeName);
				return { success: true, data: result };
			}

			case "add_review_type": {
				const params = args as {
					name: string;
					fields: Array<{ name: string; type: string }>;
				};
				if (!params?.name || !params?.fields) {
					return { success: false, error: "name and fields are required" };
				}
				const result = await addType(storage, params);
				return { success: true, data: result };
			}

			case "add_field_to_type": {
				const params = args as {
					typeName: string;
					fieldName: string;
					fieldType: string;
				};
				if (!params?.typeName || !params?.fieldName || !params?.fieldType) {
					return {
						success: false,
						error: "typeName, fieldName, and fieldType are required",
					};
				}
				const result = await addField(storage, params);
				return { success: true, data: result };
			}

			case "add_review_record": {
				const params = args as {
					typeName: string;
					data: Record<string, unknown>;
				};
				if (!params?.typeName || !params?.data) {
					return { success: false, error: "typeName and data are required" };
				}
				const result = await addRecord(storage, params);
				return { success: true, data: result };
			}

			default:
				return { success: false, error: `Unknown tool: ${toolName}` };
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return { success: false, error: errorMessage };
	}
}

/**
 * CORS headers for browser access (optional)
 */
function corsHeaders(): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
	};
}

/**
 * Main Cloudflare Worker fetch handler
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: corsHeaders(),
			});
		}

		// Validate API key
		if (!validateApiKey(request, env)) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Unauthorized - Invalid or missing API key",
				}),
				{
					status: 401,
					headers: {
						"Content-Type": "application/json",
						...corsHeaders(),
					},
				}
			);
		}

		// Initialize storage if needed
		if (!storage) {
			try {
				storage = createStorageProvider(env as Record<string, string>);
				await storage.initialize();
			} catch (error) {
				return new Response(
					JSON.stringify({
						success: false,
						error: `Failed to initialize storage: ${error}`,
					}),
					{
						status: 500,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders(),
						},
					}
				);
			}
		}

		// Parse request URL
		const url = new URL(request.url);

		// Health check endpoint
		if (url.pathname === "/health" || url.pathname === "/") {
			return new Response(
				JSON.stringify({
					success: true,
					service: "record-mcp",
					version: "0.1.0",
					status: "healthy",
				}),
				{
					headers: {
						"Content-Type": "application/json",
						...corsHeaders(),
					},
				}
			);
		}

		// MCP tool call endpoint
		if (url.pathname === "/mcp" && request.method === "POST") {
			try {
				const body = await request.json();
				const { tool, arguments: args } = body as {
					tool: string;
					arguments: Record<string, unknown>;
				};

				if (!tool) {
					return new Response(
						JSON.stringify({
							success: false,
							error: "Missing 'tool' parameter",
						}),
						{
							status: 400,
							headers: {
								"Content-Type": "application/json",
								...corsHeaders(),
							},
						}
					);
				}

				const result = await handleToolCall(tool, args || {}, storage);

				return new Response(JSON.stringify(result), {
					status: result.success ? 200 : 400,
					headers: {
						"Content-Type": "application/json",
						...corsHeaders(),
					},
				});
			} catch (error) {
				return new Response(
					JSON.stringify({
						success: false,
						error: `Invalid request: ${error}`,
					}),
					{
						status: 400,
						headers: {
							"Content-Type": "application/json",
							...corsHeaders(),
						},
					}
				);
			}
		}

		// List available tools
		if (url.pathname === "/tools" && request.method === "GET") {
			return new Response(
				JSON.stringify({
					success: true,
					tools: [
						{
							name: "list_review_types",
							description:
								"List all review types with their schemas and record counts",
						},
						{
							name: "get_review_type",
							description:
								"Get detailed information about a specific review type including all records",
							parameters: ["typeName"],
						},
						{
							name: "add_review_type",
							description: "Create a new review type with a custom schema",
							parameters: ["name", "fields"],
						},
						{
							name: "add_field_to_type",
							description: "Add a new field to an existing review type schema",
							parameters: ["typeName", "fieldName", "fieldType"],
						},
						{
							name: "add_review_record",
							description: "Add a new review record to a type",
							parameters: ["typeName", "data"],
						},
					],
				}),
				{
					headers: {
						"Content-Type": "application/json",
						...corsHeaders(),
					},
				}
			);
		}

		// 404 for unknown routes
		return new Response(
			JSON.stringify({
				success: false,
				error: "Not found",
				endpoints: {
					"/": "Health check",
					"/health": "Health check",
					"/tools": "List available tools (GET)",
					"/mcp": "Call MCP tool (POST)",
				},
			}),
			{
				status: 404,
				headers: {
					"Content-Type": "application/json",
					...corsHeaders(),
				},
			}
		);
	},
};
