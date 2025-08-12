import type { DeviceCluster, DeviceEndpoint } from '../server/server';
import { MATTER_CLUSTERS, IGNORED_MATTER_CLUSTERS } from './cluster';
import { type MatterClusterInterface } from './cluster';
import type { Device } from '../../device/device';
import type { MatterCluster } from './cluster';
import type { MatterClient } from './client';

export class MatterEndpoint {
	public endpoints: MatterEndpoint[] = [];
	public clusters: MatterCluster<MatterClusterInterface>[] = [];

	readonly #nodeId: string;
	readonly #endpointNumber: string;
	readonly #matterClient: MatterClient;
	readonly #clusterMeta: DeviceCluster[];

	public constructor(
		nodeId: string,
		endpointNumber: string,
		clusterMeta: DeviceCluster[],
		matterClient: MatterClient,
		endpointMeta: DeviceEndpoint[]
	) {
		this.#nodeId = nodeId;
		this.#endpointNumber = endpointNumber;
		this.#matterClient = matterClient;
		this.#clusterMeta = clusterMeta;
		this.endpoints = endpointMeta.map(
			(endpoint) =>
				new MatterEndpoint(
					this.#nodeId,
					endpoint.number,
					endpoint.clusterMeta,
					matterClient,
					endpoint.endpoints
				)
		);
		this.clusters = this._getClusters();
	}

	protected _getClusters(): MatterCluster<MatterClusterInterface>[] {
		const clusters: MatterCluster<MatterClusterInterface>[] = [];
		for (const clusterMeta of this.#clusterMeta) {
			const ClusterWithName =
				clusterMeta.name in MATTER_CLUSTERS
					? MATTER_CLUSTERS[
							clusterMeta.name as keyof typeof MATTER_CLUSTERS
						]
					: null;
			if (!ClusterWithName) {
				if (!IGNORED_MATTER_CLUSTERS.includes(clusterMeta.name)) {
					console.error(
						`${this.#nodeId}/${this.#endpointNumber}: Cluster ${clusterMeta.name} not found`
					);
				}
				continue;
			}
			clusters.push(
				new ClusterWithName(
					this.#nodeId,
					this.#endpointNumber,
					clusterMeta.id,
					clusterMeta.name,
					this.#matterClient
				)
			);
		}
		return clusters;
	}

	public onAttributeChanged(
		attributePath: string[],
		newValue: unknown
	): void {
		for (const device of this.clusters) {
			device.proxy.onAttributeChanged(attributePath, newValue);
		}
	}
}
export class MatterDevice extends MatterEndpoint implements Device {
	public recursiveClusters: MatterCluster<MatterClusterInterface>[];
	public recursiveEndpoints: MatterEndpoint[];
	readonly #rootEndpointNumber: string;
	readonly #nodeId: string;

	public constructor(
		nodeId: string,
		rootEndpointNumber: string,
		public name: string,
		matterClient: MatterClient,
		clusterMeta: DeviceCluster[],
		endpointMeta: DeviceEndpoint[]
	) {
		super(
			nodeId,
			rootEndpointNumber,
			clusterMeta,
			matterClient,
			endpointMeta
		);
		this.#rootEndpointNumber = rootEndpointNumber;
		this.#nodeId = nodeId;
		this.recursiveClusters = [];
		this.recursiveEndpoints = [];
		const walkRecursives = (device: MatterEndpoint): void => {
			for (const cluster of device.clusters) {
				this.recursiveClusters.push(cluster);
			}
			for (const endpoint of device.endpoints) {
				this.recursiveEndpoints.push(endpoint);
				walkRecursives(endpoint);
			}
		};
		walkRecursives(this);
	}

	public getUniqueId(): string {
		return `matter:${this.#nodeId}:${this.#rootEndpointNumber}`;
	}
}
