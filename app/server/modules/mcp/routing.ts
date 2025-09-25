import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { ModuleConfig } from '..';
import { z } from 'zod';

export function initRouting(config: ModuleConfig): ServeOptions {
	// Create MCP server instance
	const server = new McpServer(
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

	const getDevicesOutputSchema = z.object({
		devices: z.array(z.object({
			id: z.string(),
			name: z.string(),
			source: z.string(),
			clusters: z.array(z.string()),
		})),
	});

	server.registerTool(
		'get_devices',
		{
			title: 'Get all smart devices in this system. Where clusters are roughly equivalent to capabilities the device has',
			description: 'Get all smart devices in this system. Where clusters are roughly equivalent to capabilities the device has',
			inputSchema: {},
			outputSchema: {
				devices: getDevicesOutputSchema
			},
		},
		async () => {
			const deviceAPI = await config.modules.device.api.value;
			const deviceInfos  = [];
			const devices = deviceAPI.devices.current();
			for (const deviceId in devices) {
				const device = devices[deviceId];
				deviceInfos.push({
					id: device.getUniqueId(),
					name: device.getDeviceName(),
					source: device.getSource(),
					clusters: device.allClusters.map((cluster) => cluster.getName()),
				});
			}
			return {
			stru
			}
		}
	);

	// Set up tool handlers
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: [
				{
					name: 'get_devices',
					description:
						'Get all available devices in the home automation system with their status',
					inputSchema: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'get_temperature',
					description:
						'Get current temperature readings from all temperature sensors',
					inputSchema: {
						type: 'object',
						properties: {
							location: {
								type: 'string',
								description:
									'Specific temperature sensor location (optional)',
							},
						},
					},
				},
				{
					name: 'get_home_state',
					description:
						'Get current home detection state for all tracked devices/people',
					inputSchema: {
						type: 'object',
						properties: {},
					},
				},
				{
					name: 'control_device',
					description:
						'Control a specific device (turn on/off, set brightness, etc.)',
					inputSchema: {
						type: 'object',
						properties: {
							deviceId: {
								type: 'string',
								description: 'The ID of the device to control',
							},
							action: {
								type: 'string',
								description:
									'The action to perform (on, off, set_brightness, etc.)',
							},
							value: {
								type: 'string',
								description:
									'Optional value for the action (e.g., brightness level)',
							},
						},
						required: ['deviceId', 'action'],
					},
				},
				{
					name: 'get_system_status',
					description:
						'Get overall system status including all modules and their health',
					inputSchema: {
						type: 'object',
						properties: {},
					},
				},
			],
		};
	});

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		try {
			switch (name) {
				case 'get_devices':
					return await getDevices(config);

				case 'get_temperature':
					return await getTemperature(config, args?.location);

				case 'get_home_state':
					return await getHomeState(config);

				case 'control_device':
					return await controlDevice(
						config,
						args?.deviceId,
						args?.action,
						args?.value
					);

				case 'get_system_status':
					return await getSystemStatus(config);

				default:
					throw new Error(`Unknown tool: ${name}`);
			}
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
					},
				],
				isError: true,
			};
		}
	});

	return createServeOptions({
		'/mcp': async (req) => {
			// Handle MCP requests via HTTP
			const url = new URL(req.url);

			if (req.method === 'POST') {
				try {
					const body = await req.text();
					const request = JSON.parse(body);

					// Process MCP request through the server
					const response = await server.request(request);

					return new Response(JSON.stringify(response), {
						headers: { 'Content-Type': 'application/json' },
					});
				} catch (error) {
					return new Response(
						JSON.stringify({
							error: 'Failed to process MCP request',
							details:
								error instanceof Error
									? error.message
									: 'Unknown error',
						}),
						{
							status: 500,
							headers: { 'Content-Type': 'application/json' },
						}
					);
				}
			}

			return new Response(
				JSON.stringify({
					message: 'MCP server endpoint',
					method: 'POST to interact with MCP tools',
					availableTools: [
						'get_devices',
						'get_temperature',
						'get_home_state',
						'control_device',
						'get_system_status',
					],
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		},
	});
}

// Tool implementations
async function getDevices(config: ModuleConfig) {
	try {
		const modules = await config.modules;
		const deviceAPI = await modules.device.api.value;
		const currentDeviceIds = Object.keys(await deviceAPI.devices.get());
		const knownDevices = deviceAPI.getStoredDevices();
		const now = Date.now();

		// Update current devices status
		for (const deviceId of currentDeviceIds) {
			knownDevices[deviceId] = {
				id: deviceId,
				status: 'online',
				lastSeen: now,
				name: knownDevices[deviceId]?.name,
			};
		}

		// Create response with all known devices
		const devices = Object.values(knownDevices).map((device) => ({
			...device,
			status: currentDeviceIds.includes(device.id) ? 'online' : 'offline',
		}));

		// Sort by status (online first) then by ID
		devices.sort((a, b) => {
			if (a.status !== b.status) {
				return a.status === 'online' ? -1 : 1;
			}
			return a.id.localeCompare(b.id);
		});

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
							devices: devices,
							count: devices.length,
							online: devices.filter((d) => d.status === 'online')
								.length,
							offline: devices.filter(
								(d) => d.status === 'offline'
							).length,
						},
						null,
						2
					),
				},
			],
		};
	} catch (error) {
		throw new Error(
			`Failed to get devices: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

async function getTemperature(config: ModuleConfig, location?: string) {
	try {
		const modules = await config.modules;

		if (location) {
			// Get temperature for specific location
			const temp = await modules.temperature.getTemp(location);
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								location: location,
								temperature: temp,
								unit: 'celsius',
								timestamp: new Date().toISOString(),
							},
							null,
							2
						),
					},
				],
			};
		} else {
			// Get all temperature readings
			// For now, return a placeholder since we need to implement getting all locations
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								message:
									'Temperature retrieval for all locations not yet implemented',
								note: 'Use location parameter to get specific temperature readings',
							},
							null,
							2
						),
					},
				],
			};
		}
	} catch (error) {
		throw new Error(
			`Failed to get temperature: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

async function getHomeState(config: ModuleConfig) {
	try {
		const modules = await config.modules;
		const homeStates = modules.homeDetector.getAll();

		const states = Object.entries(homeStates).map(([name, state]) => ({
			name: name,
			state: state,
			status: state === 'home' ? 'home' : 'away',
		}));

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
							homeStates: states,
							summary: {
								home: states.filter((s) => s.state === 'home')
									.length,
								away: states.filter((s) => s.state === 'away')
									.length,
								total: states.length,
							},
							timestamp: new Date().toISOString(),
						},
						null,
						2
					),
				},
			],
		};
	} catch (error) {
		throw new Error(
			`Failed to get home state: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

async function controlDevice(
	config: ModuleConfig,
	deviceId?: string,
	action?: string,
	value?: string
) {
	if (!deviceId || !action) {
		throw new Error('deviceId and action are required');
	}

	try {
		const modules = await config.modules;

		// This is a placeholder implementation
		// You would need to implement actual device control logic here
		// based on the device type and available control methods

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
							message: 'Device control not yet implemented',
							deviceId: deviceId,
							action: action,
							value: value,
							note: 'This would control the device through the appropriate module (WLED, EWeLink, Matter, etc.)',
						},
						null,
						2
					),
				},
			],
		};
	} catch (error) {
		throw new Error(
			`Failed to control device: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

async function getSystemStatus(config: ModuleConfig) {
	try {
		const modules = await config.modules;
		const moduleNames = Object.keys(modules);

		const status = {
			system: 'running',
			modules: moduleNames.map((name) => ({
				name: name,
				status: 'active',
				// Add more detailed status information as needed
			})),
			timestamp: new Date().toISOString(),
			version: '1.0.0',
		};

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(status, null, 2),
				},
			],
		};
	} catch (error) {
		throw new Error(
			`Failed to get system status: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
