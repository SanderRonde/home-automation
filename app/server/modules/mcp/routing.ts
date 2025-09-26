import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { MCPNodeServer } from './server';
import type { ModuleConfig } from '..';

let mcpNodeServer: MCPNodeServer | null = null;

export async function initRouting(config: ModuleConfig): Promise<ServeOptions> {
	// Create and start Node.js server for MCP
	mcpNodeServer = new MCPNodeServer(config);
	const port = await mcpNodeServer.start();

	return createServeOptions({
		'/mcp': async (req: Request) => {
			// Proxy request to Node.js server
			const nodeServer = mcpNodeServer?.getServer();
			if (!nodeServer) {
				return new Response('MCP server not available', {
					status: 503,
				});
			}

			// Forward the request to the Node.js server
			const nodeUrl = `http://localhost:${port}/mcp`;
			const forwardedReq = new Request(nodeUrl, {
				method: req.method,
				headers: req.headers,
				body: req.body,
			});

			try {
				const response = await fetch(forwardedReq);
				return response;
			} catch (error) {
				console.error(
					'Error forwarding request to MCP Node.js server:',
					error
				);
				return new Response('Internal server error', { status: 500 });
			}
		},
	});
}
