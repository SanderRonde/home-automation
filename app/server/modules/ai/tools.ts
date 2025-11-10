import { getTypesForCluster } from '../device/clusterSpec';
import type { ChatGPTService } from './chatgpt';
import type { AllModules } from '../modules';
import type { Data } from '../../lib/data';

export function registerTools(server: ChatGPTService, modules: AllModules): void {
	// Register MCP tools
	server.registerTool(
		'get_devices',
		{
			type: 'function',
			function: {
				name: 'get_devices',
				description:
					'Get all smart devices in this system. Where clusters are roughly equivalent to capabilities the device has',
				parameters: {
					type: 'object',
					properties: {},
					required: [],
				},
			},
		},
		async () => {
			const deviceAPI = await modules.device.api.value;
			const deviceInfos = [];
			const devices = deviceAPI.devices.current();
			for (const deviceId in devices) {
				const device = devices[deviceId];
				deviceInfos.push({
					id: device.getUniqueId(),
					name: await device.getDeviceName(),
					source: device.getSource(),
					clusters: device.allClusters.map(({ cluster }) => ({
						baseClusterName: cluster.getBaseCluster().prototype.constructor.name,
					})),
				});
			}

			return JSON.stringify({ devices: deviceInfos });
		}
	);

	server.registerTool(
		'get_cluster_definition',
		{
			type: 'function',
			function: {
				name: 'get_cluster_definition',
				description: 'Get the definition of a cluster',
				parameters: {
					type: 'object',
					properties: {
						baseClusterName: {
							type: 'string',
							description: 'The name of the cluster to get the definition of',
						},
					},
					required: ['baseClusterName'],
				},
			},
		},
		async (args: { baseClusterName: string }) => {
			return Promise.resolve(JSON.stringify(getTypesForCluster(args.baseClusterName)));
		}
	);

	// Register MCP tools
	server.registerTool(
		'get_device_clusters_property_values',
		{
			type: 'function',
			function: {
				name: 'get_device_clusters_property_values',
				description: 'Get the value of a property of a cluster within a device',
				parameters: {
					type: 'object',
					properties: {
						deviceId: {
							type: 'string',
							description: 'The ID of the device to get the property value from',
						},
						baseClusterName: {
							type: 'string',
							description: 'The name of the cluster to get the property value from',
						},
						propertyName: {
							type: 'string',
							description:
								'The name of the property to get the value of. Use {{get_cluster_definition(baseClusterName)}} to get a list of available properties for a given baseClusterName',
						},
					},
					required: ['deviceId', 'clusterName', 'propertyName'],
				},
			},
		},
		async (args: { deviceId: string; baseClusterName: string; propertyName: string }) => {
			const deviceAPI = await modules.device.api.value;
			const devices = deviceAPI.devices.current();
			const device = devices[args.deviceId];
			if (!device) {
				return JSON.stringify({ error: 'Device not found' });
			}
			const clusters = device.getAllClustersByBaseClusterName(args.baseClusterName);
			if (!clusters.length) {
				return JSON.stringify({ error: 'No clusters found' });
			}
			const propertyValues = await Promise.all(
				clusters.map(async (cluster) => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					const property = (cluster as any)[args.propertyName] as Data<unknown>;
					if (!property) {
						return JSON.stringify({
							error: 'Property not found, ensure it exists by getting the definition of the cluster',
						});
					}
					return JSON.stringify(await property.get());
				})
			);
			return JSON.stringify(propertyValues);
		}
	);

	server.registerTool(
		'call_device_cluster_method',
		{
			type: 'function',
			function: {
				name: 'call_device_cluster_method',
				description: 'Call a method of a cluster within a device',
				parameters: {
					type: 'object',
					properties: {
						deviceId: {
							type: 'string',
							description: 'The ID of the device to call the method on',
						},
						baseClusterName: {
							type: 'string',
							description: 'The name of the cluster to call the method on',
						},
						methodName: {
							type: 'string',
							description:
								'The name of the method to call. Use {{get_cluster_definition(baseClusterName)}} to get a list of available methods for a given baseClusterName',
						},
						methodArgs: {
							type: 'object',
							description:
								'The arguments to pass to the method. Use the definition of the method to get the arguments and pass them as a simple JSON object. If no args, then pass an empty object',
							properties: {},
							additionalProperties: true,
							required: [],
						},
					},
					required: ['deviceId', 'clusterName', 'propertyName', 'methodArgs'],
				},
			},
		},
		async (args: {
			deviceId: string;
			baseClusterName: string;
			methodName: string;
			methodArgs: Record<string, unknown>;
		}) => {
			const deviceAPI = await modules.device.api.value;
			const devices = deviceAPI.devices.current();
			const device = devices[args.deviceId];
			if (!device) {
				return JSON.stringify({ error: 'Device not found' });
			}
			const clusters = device.getAllClustersByBaseClusterName(args.baseClusterName);
			if (!clusters.length) {
				return JSON.stringify({ error: 'No clusters found' });
			}
			const methodValues = await Promise.all(
				clusters.map(async (cluster) => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					const method = (cluster as any)[args.methodName] as (
						arg: Record<string, unknown>
					) => Promise<unknown>;
					if (!method) {
						return JSON.stringify({
							error: 'Method not found, ensure it exists by getting the definition of the cluster',
						});
					}
					return JSON.stringify(await method(args.methodArgs));
				})
			);
			return JSON.stringify(methodValues);
		}
	);
}
