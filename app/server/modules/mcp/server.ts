import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Server, IncomingMessage, ServerResponse } from 'http';
import { logTag } from '../../lib/logging/logger';
import { Database } from '../../lib/db';
import type { AddressInfo } from 'net';
import type { ModuleConfig } from '..';
import type { MCPDB } from './index';
import { createServer } from 'http';

export class MCPNodeServer {
	private readonly server: McpServer;
	private readonly transport: StreamableHTTPServerTransport;
	private httpServer: Server | null = null;
	private readonly mcpDb: Database<MCPDB>;

	public constructor(private readonly config: ModuleConfig) {
		// Initialize MCP database
		this.mcpDb = new Database<MCPDB>('mcp.json');
		// Create MCP server instance
		this.server = new McpServer(
			{
				name: 'home-automation',
				version: '1.0.0',
			},
			{
				capabilities: {
					tools: {},
				},
				instructions:
					'You are a helpful assistant that can help with home automation tasks.',
			}
		);

		this.transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		this.setupServer();
	}

	private checkAuthorization(req: IncomingMessage): boolean {
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			return false;
		}

		// Check for Bearer token format
		const token = authHeader.startsWith('Bearer ')
			? authHeader.substring(7)
			: authHeader;

		// Get the stored auth keys from database
		const storedKeys = this.mcpDb.current().authKeys;
		if (!storedKeys || storedKeys.length === 0) {
			return false;
		}

		// Check if the provided token matches any of the stored keys
		return storedKeys.includes(token);
	}

	private setupServer() {
		// Register MCP tools
		this.server.registerTool(
			'get_devices',
			{
				title: 'Get all smart devices in this system. Where clusters are roughly equivalent to capabilities the device has',
				description:
					'Get all smart devices in this system. Where clusters are roughly equivalent to capabilities the device has',
			},
			async () => {
				const deviceAPI = await this.config.modules.device.api.value;
				const deviceInfos = [];
				const devices = deviceAPI.devices.current();
				for (const deviceId in devices) {
					const device = devices[deviceId];
					deviceInfos.push({
						id: device.getUniqueId(),
						name: device.getDeviceName(),
						source: device.getSource(),
						clusters: device.allClusters.map((cluster) =>
							cluster.getName()
						),
					});
				}

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ devices: deviceInfos }),
						},
					],
				};
			}
		);

		// Create HTTP server
		this.httpServer = createServer(
			(req: IncomingMessage, res: ServerResponse) => {
				// Only handle /mcp requests
				if (req.url !== '/mcp') {
					res.writeHead(404);
					res.end('Not found');
					return;
				}

				// Check authorization
				if (!this.checkAuthorization(req)) {
					res.writeHead(401, { 'Content-Type': 'application/json' });
					res.end(
						JSON.stringify({
							jsonrpc: '2.0',
							error: {
								code: -32001,
								message:
									'Unauthorized. Please provide a valid authorization token.',
							},
							id: null,
						})
					);
					return;
				}

				try {
					// Read request body
					let body = '';
					req.on('data', (chunk: Buffer) => {
						body += chunk.toString();
					});

					req.on('end', async () => {
						try {
							// Parse the JSON body before passing to transport
							let parsedBody;
							try {
								parsedBody = JSON.parse(body);
							} catch (parseError) {
								console.error('JSON parse error:', parseError);
								res.writeHead(400);
								res.end(
									JSON.stringify({
										jsonrpc: '2.0',
										error: {
											code: -32700,
											message: 'Parse error',
										},
										id: null,
									})
								);
								return;
							}

							// Handle MCP request using the transport
							await this.transport.handleRequest(
								req,
								res,
								parsedBody
							);
						} catch (error) {
							console.error('MCP request error:', error);
							res.writeHead(500);
							res.end(
								JSON.stringify({
									error: 'Internal server error',
								})
							);
						}
					});
				} catch (error) {
					console.error('MCP server error:', error);
					res.writeHead(500);
					res.end(JSON.stringify({ error: 'Internal server error' }));
				}
			}
		);
	}

	public async start(): Promise<number> {
		// Connect MCP server to transport
		await this.server.connect(this.transport);

		return new Promise<number>((resolve, reject) => {
			if (this.httpServer) {
				const server = this.httpServer;
				server.listen(0, () => {
					const port = (server.address() as AddressInfo).port;
					logTag(
						'MCP server',
						'magenta',
						`listening on port ${port}`
					);
					resolve(port);
				});
			} else {
				reject(new Error('HTTP server not initialized'));
			}
		});
	}

	public stop(): void {
		if (this.httpServer) {
			this.httpServer.close();
		}
	}

	public getServer(): Server | null {
		return this.httpServer;
	}
}
