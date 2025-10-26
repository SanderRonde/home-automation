import {
	HexLEDActionsCluster,
	HexLEDColorControlCluster,
	HexLEDLevelControlCluster,
	HexLEDOnOffCluster,
} from './cluster';
import { DeviceEndpoint, DeviceSource } from '../../device/device';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Cluster } from '../../device/cluster';
import type { Device } from '../../device/device';
import type { LEDClient } from './led-client';

export class HexLEDDevice extends DeviceEndpoint implements Device {
	public readonly onChange: EventEmitter<void> = new EventEmitter();

	public readonly clusters: Cluster[];
	public readonly endpoints: DeviceEndpoint[] = [];

	public constructor(
		private readonly _url: string,
		protected readonly _client: LEDClient
	) {
		super();

		this.clusters = [
			new HexLEDOnOffCluster(this._client),
			new HexLEDLevelControlCluster(this._client),
			new HexLEDColorControlCluster(this._client),
			new HexLEDActionsCluster(this._client),
		];

		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => {
				return this.onChange.emit(undefined);
			});
		}
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this._url}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.HEX_LED;
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve('Hexagon LED Panel');
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(this._url);
	}

	public override [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
		this._client[Symbol.dispose]();
	}
}
