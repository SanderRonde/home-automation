import { createServeOptions, staticResponse } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import { MCPNodeServer } from './server';
import type { ModuleConfig } from '..';
import type { MCPDB } from './index';
import { randomBytes } from 'crypto';

let mcpNodeServer: MCPNodeServer | null = null;

async function _initRouting(config: ModuleConfig) {
	// Create and start Node.js server for MCP
	mcpNodeServer = new MCPNodeServer(config);
	const port = await mcpNodeServer.start();

	return createServeOptions(
		{
			'/mcp': async (req, _server, { error }) => {
				// Proxy request to Node.js server
				const nodeServer = mcpNodeServer?.getServer();
				if (!nodeServer) {
					return error('MCP server not available', 503);
				}

				// Forward the request to the Node.js server
				const nodeUrl = `http://localhost:${port}/mcp`;
				const forwardedReq = new Request(nodeUrl, {
					method: req.method,
					headers: req.headers,
					body: req.body,
				});

				try {
					// eslint-disable-next-line no-restricted-globals
					const response = await fetch(forwardedReq);
					return staticResponse(response);
				} catch {
					console.error('Error forwarding request to MCP Node.js server:', error);
					return error('Internal server error', 500);
				}
			},
			'/keys': {
				GET: (_req, _server, { json }) => {
					const keys = (config.db as Database<MCPDB>).current().authKeys || [];
					return json({ keys });
				},
				POST: (_req, _server, { json }) => {
					const db = config.db as Database<MCPDB>;
					const authKey = randomBytes(32).toString('hex');

					db.update((old) => ({
						...old,
						authKeys: [...(old.authKeys || []), authKey],
					}));

					return json({ key: authKey });
				},
			},
			'/keys/:key': {
				DELETE: (req, _server, { json, error }) => {
					const keyToDelete = req.params.key;
					if (!keyToDelete) {
						return error('Key parameter is required', 400);
					}

					const db = config.db as Database<MCPDB>;
					const keys = db.current().authKeys || [];

					if (!keys.includes(keyToDelete)) {
						return error('Key not found', 404);
					}

					const updatedKeys = keys.filter((key) => key !== keyToDelete);
					db.update((old) => ({
						...old,
						authKeys: updatedKeys,
					}));

					return json({ success: true });
				},
			},
		},
		{
			'/mcp': false,
			'/keys': true,
			'/keys/:key': true,
		}
	);
}

export const initRouting = _initRouting as (config: ModuleConfig) => Promise<ServeOptions<unknown>>;

export type MCPRoutes =
	Awaited<ReturnType<typeof _initRouting>> extends ServeOptions<infer R> ? R : never;
