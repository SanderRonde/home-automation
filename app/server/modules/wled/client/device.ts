import {
	WLEDColorControlCluster,
	WLEDLevelControlCluster,
	WLEDOnOffCluster,
	WLEDActionsCluster,
} from './cluster';
import { DeviceEndpoint, DeviceSource } from '../../device/device';
import type { WLEDClient, WLEDClientInfo } from 'wled-client';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Cluster } from '../../device/cluster';
import type { Device } from '../../device/device';

export class WLEDDevice extends DeviceEndpoint implements Device {
	public readonly onChange: EventEmitter<void> = new EventEmitter();
	public clusters: Cluster[];
	public endpoints: DeviceEndpoint[];

	public constructor(
		private readonly _ip: string,
		private readonly _info: WLEDClientInfo,
		protected readonly _client: WLEDClient
	) {
		super();
		this.clusters = [
			new WLEDOnOffCluster(this._client),
			new WLEDColorControlCluster(this._client),
			new WLEDLevelControlCluster(this._client),
			new WLEDActionsCluster(this._client),
		];
		this.endpoints = [];
		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => this.onChange.emit(undefined));
		}
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this._info.mac ?? this._ip}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.WLED;
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve(this._info.name ?? this._ip);
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(`http://${this._ip}`);
	}
}
