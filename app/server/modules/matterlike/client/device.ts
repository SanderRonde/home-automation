import type { Cluster, DeviceClusterName } from '../../device/cluster';
import { DeviceEndpoint, DeviceSource } from '../../device/device';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Device } from '../../device/device';
import { matterLikeClusters } from './cluster';

export class MatterLikeDevice extends DeviceEndpoint implements Device {
	public readonly onChange: EventEmitter<void> = new EventEmitter();

	public readonly clusters: Cluster[];
	public readonly endpoints: DeviceEndpoint[] = [];

	public constructor(
		public readonly ip: string,
		clusters: DeviceClusterName[]
	) {
		super();
		this.clusters = [];
		for (const clusterName of clusters) {
			if (matterLikeClusters[clusterName]) {
				const cluster = new matterLikeClusters[clusterName](ip);
				cluster.onChange.listen(() => this.onChange.emit(undefined));
				this.clusters.push(cluster);
			}
		}
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this.ip}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.MATTER_LIKE;
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve(`Matter Like Device: ${this.ip}`);
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(`http://${this.ip}`);
	}

	public getDeviceStatus(): 'online' | 'offline' {
		return 'online';
	}

	public [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
	}
}
