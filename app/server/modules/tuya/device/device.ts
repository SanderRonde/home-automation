import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Cluster } from '../../device/cluster';

export class TuyaDeviceEndpoint extends DeviceEndpoint {
	public readonly onChange: EventEmitter<void> = new EventEmitter();

	protected constructor(
		public readonly name: string,
		public readonly clusters: Cluster[],
		public readonly endpoints: TuyaDeviceEndpoint[]
	) {
		super();
		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => this.onChange.emit(undefined));
		}
		for (const endpoint of this.endpoints) {
			endpoint.onChange.listen(() => this.onChange.emit(undefined));
		}
	}

	public async getDeviceName(): Promise<string> {
		return Promise.resolve(this.name);
	}

	public getDeviceStatus(): 'online' | 'offline' {
		return 'online';
	}
}

export abstract class TuyaDevice extends TuyaDeviceEndpoint implements Device {
	protected constructor(
		public readonly name: string,
		public readonly deviceId: string,
		public readonly clusters: Cluster[],
		public readonly endpoints: TuyaDeviceEndpoint[]
	) {
		super(name, clusters, endpoints);
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this.deviceId}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.TUYA;
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}
}
