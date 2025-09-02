import {
	WLEDColorControlCluster,
	WLEDLevelControlCluster,
	WLEDOnOffCluster,
} from './cluster';
import { DeviceEndpoint, DeviceSource } from '../../device/device';
import type { WLEDClient, WLEDClientInfo } from 'wled-client';
import type { Cluster } from '../../device/cluster';
import type { Device } from '../../device/device';

export class WLEDDevice extends DeviceEndpoint implements Device {
	public constructor(
		private readonly _ip: string,
		private readonly _info: WLEDClientInfo,
		protected readonly _client: WLEDClient
	) {
		super();
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this._info.mac ?? this._ip}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.WLED;
	}

	public getDeviceName(): string {
		return this._info.name ?? this._ip;
	}

	public get clusters(): Cluster[] {
		return [
			new WLEDOnOffCluster(this._client),
			new WLEDColorControlCluster(this._client),
			new WLEDLevelControlCluster(this._client),
		];
	}

	public get endpoints(): DeviceEndpoint[] {
		return [];
	}
}
