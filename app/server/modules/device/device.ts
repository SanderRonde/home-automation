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
	public get allClusters(): Cluster[] {
		const clusters: Cluster[] = [...this.clusters];
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
			if (
				(
					cluster.constructor as unknown as {
						clusterName: DeviceClusterName;
					}
				).clusterName === type.clusterName
			) {
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
		return this.allClusters.filter(
			(cluster) =>
				(
					cluster.constructor as unknown as {
						clusterName: DeviceClusterName;
					}
				).clusterName === type.clusterName
		) as unknown as InstanceType<T>[];
	}

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
	getDeviceName(): string;
}

export class DeviceSource extends ClassEnum {
	public static readonly MATTER = new DeviceSource('matter');
	public static readonly EWELINK = new DeviceSource('ewelink');
	public static readonly WLED = new DeviceSource('wled');

	public toEmoji(): string {
		switch (this) {
			case DeviceSource.MATTER:
				return '⚛️';
			case DeviceSource.EWELINK:
				return '🔗';
			case DeviceSource.WLED:
				return '💡';
			default:
				throw new Error('Invalid DeviceSource');
		}
	}
}
