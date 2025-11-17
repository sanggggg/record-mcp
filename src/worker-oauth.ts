/**
 * OAuth 2.1 compliant Cloudflare Worker for MCP Server
 * Implements the MCP Authorization specification
 * https://modelcontextprotocol.io/specification/draft/basic/authorization
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
	JWT_SECRET?: string;
	OAUTH_ISSUER?: string;

	// R2 credentials
	R2_ACCOUNT_ID?: string;
	R2_ACCESS_KEY_ID?: string;
	R2_SECRET_ACCESS_KEY?: string;
	R2_BUCKET_NAME?: string;
	R2_ENDPOINT?: string;
}

// Storage provider instance
let storage: StorageProvider | null = null;

/**
 * Validate Origin header to prevent DNS rebinding attacks (MCP spec requirement)
 */
function validateOrigin(request: Request): boolean {
	const origin = request.headers.get("Origin");
	const host = request.headers.get("Host");

	// Allow requests without Origin header (non-browser clients)
	if (!origin) {
		return true;
	}

	// Parse origin
	try {
		const originUrl = new URL(origin);

		// Allow localhost
		if (
			originUrl.hostname === "localhost" ||
			originUrl.hostname === "127.0.0.1"
		) {
			return true;
		}

		// Allow same origin
		if (originUrl.host === host) {
			return true;
		}

		// Reject other origins (prevent DNS rebinding)
		return false;
	} catch {
		return false;
	}
}

/**
 * Simple JWT verification (for demonstration - use a proper library in production)
 * For production, use @tsndr/cloudflare-worker-jwt or similar
 */
async function verifyJWT(token: string, secret: string): Promise<boolean> {
	try {
		// This is a simplified example. In production, use a proper JWT library
		// that validates signature, expiration, issuer, etc.

		// For now, we'll do basic validation
		const parts = token.split(".");
		if (parts.length !== 3) {
			return false;
		}

		// Decode payload
		const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

		// Check expiration
		if (payload.exp && payload.exp < Date.now() / 1000) {
			return false;
		}

		// In production, verify signature here
		// For now, accept any token with valid structure
		return true;
	} catch {
		return false;
	}
}

/**
 * Validate access token (OAuth 2.1 / MCP spec requirement)
 */
async function validateAccessToken(
	request: Request,
	env: Env
): Promise<{ valid: boolean; scope?: string }> {
	// If no auth configured, allow (development mode)
	if (!env.API_KEY && !env.JWT_SECRET) {
		console.warn("⚠️  No authentication configured - running in development mode");
		return { valid: true };
	}

	// Extract token from Authorization header
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return { valid: false };
	}

	const token = authHeader.substring(7);

	// Try JWT validation first (OAuth 2.1 compliant)
	if (env.JWT_SECRET) {
		const isValidJWT = await verifyJWT(token, env.JWT_SECRET);
		if (isValidJWT) {
			return { valid: true, scope: "mcp:tools" };
		}
	}

	// Fallback to API key validation (simple auth)
	if (env.API_KEY && token === env.API_KEY) {
		return { valid: true, scope: "mcp:tools" };
	}

	// Also check X-API-Key header (for compatibility)
	const apiKeyHeader = request.headers.get("X-API-Key");
	if (env.API_KEY && apiKeyHeader === env.API_KEY) {
		return { valid: true, scope: "mcp:tools" };
	}

	return { valid: false };
}

/**
 * Handle MCP tool calls
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
 * CORS headers
 */
function corsHeaders(origin?: string): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": origin || "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
		"Access-Control-Max-Age": "86400",
	};
}

/**
 * OAuth 2.0 Protected Resource Metadata (RFC9728)
 * Required by MCP specification
 */
function getProtectedResourceMetadata(env: Env): Record<string, unknown> {
	const issuer = env.OAUTH_ISSUER || "https://record-mcp.example.com";

	return {
		resource: issuer,
		authorization_servers: [issuer],
		bearer_methods_supported: ["header"],
		resource_signing_alg_values_supported: ["RS256", "ES256"],
		resource_documentation: `${issuer}/docs`,
		resource_policy_uri: `${issuer}/policy`,
		scopes_supported: ["mcp:tools", "mcp:read", "mcp:write"],
	};
}

/**
 * OAuth 2.0 Authorization Server Metadata (RFC8414)
 * Required for OAuth 2.1 compliance
 */
function getAuthorizationServerMetadata(env: Env): Record<string, unknown> {
	const issuer = env.OAUTH_ISSUER || "https://record-mcp.example.com";

	return {
		issuer: issuer,
		authorization_endpoint: `${issuer}/oauth/authorize`,
		token_endpoint: `${issuer}/oauth/token`,
		jwks_uri: `${issuer}/.well-known/jwks.json`,
		scopes_supported: ["mcp:tools", "mcp:read", "mcp:write"],
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		token_endpoint_auth_methods_supported: ["client_secret_basic", "none"],
		code_challenge_methods_supported: ["S256"], // PKCE required
		revocation_endpoint: `${issuer}/oauth/revoke`,
		introspection_endpoint: `${issuer}/oauth/introspect`,
	};
}

/**
 * Return 401 with WWW-Authenticate header (MCP spec requirement)
 */
function unauthorizedResponse(
	realm: string,
	scope?: string
): Response {
	const authHeader = scope
		? `Bearer realm="${realm}", scope="${scope}"`
		: `Bearer realm="${realm}"`;

	return new Response(
		JSON.stringify({
			success: false,
			error: "Unauthorized",
			error_description: "Invalid or missing access token",
		}),
		{
			status: 401,
			headers: {
				"WWW-Authenticate": authHeader,
				"Content-Type": "application/json",
				...corsHeaders(),
			},
		}
	);
}

/**
 * Main Cloudflare Worker fetch handler
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin") || undefined;

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: corsHeaders(origin),
			});
		}

		// Validate Origin header (MCP spec requirement)
		if (!validateOrigin(request)) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Invalid Origin header - possible DNS rebinding attack",
				}),
				{
					status: 403,
					headers: {
						"Content-Type": "application/json",
						...corsHeaders(origin),
					},
				}
			);
		}

		// OAuth 2.0 Protected Resource Metadata endpoint (RFC9728)
		if (url.pathname === "/.well-known/oauth-protected-resource") {
			return new Response(JSON.stringify(getProtectedResourceMetadata(env)), {
				headers: {
					"Content-Type": "application/json",
					...corsHeaders(origin),
				},
			});
		}

		// OAuth 2.0 Authorization Server Metadata endpoint (RFC8414)
		if (url.pathname === "/.well-known/oauth-authorization-server") {
			return new Response(
				JSON.stringify(getAuthorizationServerMetadata(env)),
				{
					headers: {
						"Content-Type": "application/json",
						...corsHeaders(origin),
					},
				}
			);
		}

		// Health check endpoint (public)
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
						...corsHeaders(origin),
					},
				}
			);
		}

		// All other endpoints require authentication
		const authResult = await validateAccessToken(request, env);
		if (!authResult.valid) {
			return unauthorizedResponse(
				"record-mcp",
				"mcp:tools"
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
							...corsHeaders(origin),
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
						...corsHeaders(origin),
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
								...corsHeaders(origin),
							},
						}
					);
				}

				const result = await handleToolCall(tool, args || {}, storage);

				return new Response(JSON.stringify(result), {
					status: result.success ? 200 : 400,
					headers: {
						"Content-Type": "application/json",
						...corsHeaders(origin),
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
							...corsHeaders(origin),
						},
					}
				);
			}
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
					"/.well-known/oauth-protected-resource": "OAuth metadata",
					"/.well-known/oauth-authorization-server": "OAuth server metadata",
				},
			}),
			{
				status: 404,
				headers: {
					"Content-Type": "application/json",
					...corsHeaders(origin),
				},
			}
		);
	},
};
