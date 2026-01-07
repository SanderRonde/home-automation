import type { EventEmitter } from '../../lib/event-emitter';
import type { Cluster, DeviceClusterName } from './cluster';
import { ClassEnum } from '../../lib/enum';

/**
 * Largely borrows from Matter in shape/choices
 * but not (yet?) in implementation.
 */

// Roughly translates to a Matter endpoint
export abstract class DeviceEndpoint implements Disposable {
	public abstract readonly clusters: Cluster[];
	public abstract readonly endpoints: DeviceEndpoint[];

	public get allEndpoints(): DeviceEndpoint[] {
		const endpoints: DeviceEndpoint[] = [this];
		for (const endpoint of this.endpoints) {
			endpoints.push(...endpoint.allEndpoints);
		}
		return endpoints;
	}
	public get allClusters(): {
		cluster: Cluster;
		endpoint: DeviceEndpoint;
	}[] {
		const clusters = this.clusters.map((cluster) => ({
			cluster,
			endpoint: this as DeviceEndpoint,
		}));
		for (const endpoint of this.endpoints) {
			clusters.push(...endpoint.allClusters);
		}
		return clusters;
	}

	public getClusterByType<
		T extends typeof Cluster & {
			clusterName: DeviceClusterName;
		},
	>(type: T): InstanceType<T> | null {
		for (const cluster of this.clusters) {
			if (cluster.getBaseCluster().clusterName === type.clusterName) {
				return cluster as unknown as InstanceType<T>;
			}
		}
		return null;
	}

	public getAllClustersByType<
		T extends typeof Cluster & {
			clusterName: DeviceClusterName;
		},
	>(type: T): InstanceType<T>[] {
		return this.allClusters
			.filter(({ cluster }) => cluster.getBaseCluster().clusterName === type.clusterName)
			.map(({ cluster }) => cluster as unknown as InstanceType<T>);
	}

	public getAllClustersByBaseClusterName(name: string): unknown[] {
		return this.allClusters
			.filter(({ cluster }) => cluster.getBaseCluster().prototype.constructor.name === name)
			.map(({ cluster }) => cluster);
	}

	public abstract getDeviceName(): Promise<string>;

	public [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
		for (const endpoint of this.endpoints) {
			endpoint[Symbol.dispose]();
		}
	}
}

export interface Device extends DeviceEndpoint {
	getUniqueId(): string;
	getSource(): DeviceSource;
	onChange: EventEmitter<void>;
	getManagementUrl(): Promise<string | undefined>;
	getDeviceStatus(): 'online' | 'offline';
}

export class DeviceSource extends ClassEnum<
	'matter' | 'ewelink' | 'wled' | 'led-art' | 'homewizard' | 'tuya'
> {
	public static readonly MATTER = new DeviceSource('matter');
	public static readonly EWELINK = new DeviceSource('ewelink');
	public static readonly WLED = new DeviceSource('wled');
	public static readonly LED_ART = new DeviceSource('led-art');
	public static readonly HOMEWIZARD = new DeviceSource('homewizard');
	public static readonly TUYA = new DeviceSource('tuya');

	public toEmoji(): string {
		switch (this) {
			case DeviceSource.MATTER:
				return '⚛️';
			case DeviceSource.EWELINK:
				return '🔗';
			case DeviceSource.WLED:
				return '💡';
			case DeviceSource.LED_ART:
				return '🔷';
			case DeviceSource.HOMEWIZARD:
				return '⚡';
			case DeviceSource.TUYA:
				return '🌐';
			default:
				throw new Error('Invalid DeviceSource');
		}
	}
}
