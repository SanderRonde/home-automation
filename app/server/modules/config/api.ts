import { auth, errorHandle, requireParams } from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';
import type { DeviceEndpoint } from '../device/device';
import type { AllModules } from '../modules';

export interface ConfigDeviceEndpointResponse {
	clusters: {
		name: string;
		emoji: string;
	}[];
	endpoints: ConfigDeviceEndpointResponse[];
}

interface ConfigDeviceResponse extends ConfigDeviceEndpointResponse {
	uniqueId: string;
	name: string;
	source: {
		name: string;
		emoji: string;
	};
	allClusters: {
		name: string;
		emoji: string;
	}[];
}

export interface ConfigGetDevicesResponse {
	devices: ConfigDeviceResponse[];
}

export interface ConfigPairDeviceResponse {
	devices: string[];
}

export class APIHandler {
	public constructor(private readonly _modules: AllModules) {}

	@errorHandle
	@auth
	public getDevices(res: ResponseLike): void {
		const devices = this._modules.device.getDevices();
		const responseDevices: ConfigDeviceResponse[] = [];

		const getResponseForEndpoint = (
			endpoint: DeviceEndpoint
		): ConfigDeviceEndpointResponse => {
			const endpoints = [];
			const clusters = [];
			for (const cluster of endpoint.clusters) {
				clusters.push({
					name: cluster.getName().value,
					emoji: cluster.getName().toEmoji(),
				});
			}
			for (const subEndpoint of endpoint.endpoints) {
				endpoints.push(getResponseForEndpoint(subEndpoint));
			}
			return {
				clusters,
				endpoints,
			};
		};

		for (const device of devices) {
			const responseDevice: ConfigDeviceResponse = {
				uniqueId: device.getUniqueId(),
				name: device.getDeviceName(),
				source: {
					name: device.getSource().value,
					emoji: device.getSource().toEmoji(),
				},
				allClusters: device.allClusters.map((cluster) => ({
					name: cluster.getName().value,
					emoji: cluster.getName().toEmoji(),
				})),
				...getResponseForEndpoint(device),
			};
			responseDevices.push(responseDevice);
		}
		res.status(200).write(
			JSON.stringify({
				devices: responseDevices,
			})
		);
		res.end();
	}

	@errorHandle
	@auth
	@requireParams('code')
	public async pairDevice(
		res: ResponseLike,
		{ code }: { code: string }
	): Promise<void> {
		const matterClient = await this._modules.matter.client.value;
		const pairedDevices = await matterClient.pair(code);
		res.status(200).write(
			JSON.stringify({
				devices: pairedDevices,
			} satisfies ConfigPairDeviceResponse)
		);
		res.end();
	}
}
