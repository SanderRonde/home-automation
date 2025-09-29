import { createServeOptions, staticResponse } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { MCPNodeServer } from './server';
import type { ModuleConfig } from '..';

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
				} catch (e) {
					console.error(
						'Error forwarding request to MCP Node.js server:',
						error
					);
					return error('Internal server error', 500);
				}
			},
		},
		true
	);
}

export const initRouting = _initRouting as (
	config: ModuleConfig
) => Promise<ServeOptions<unknown>>;
