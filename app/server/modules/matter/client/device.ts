import type {
	MatterDeviceCluster,
	MatterDeviceEndpoint,
} from '../server/server';
import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import { MATTER_CLUSTERS, IGNORED_MATTER_CLUSTERS } from './cluster';
import { type MatterClusterInterface } from './cluster';
import type { MatterCluster } from './cluster';
import type { MatterClient } from './client';

export class MatterEndpoint extends DeviceEndpoint {
	public endpoints: MatterEndpoint[] = [];
	public clusters: MatterCluster<MatterClusterInterface>[] = [];

	readonly #nodeId: string;
	readonly #endpointNumber: string;
	readonly #matterClient: MatterClient;
	readonly #clusterMeta: MatterDeviceCluster[];

	public constructor(
		nodeId: string,
		endpointNumber: string,
		clusterMeta: MatterDeviceCluster[],
		matterClient: MatterClient,
		endpointMeta: MatterDeviceEndpoint[]
	) {
		super();
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
}

export class MatterDevice extends MatterEndpoint implements Device {
	readonly #rootEndpointNumber: string;
	readonly #nodeId: string;

	public constructor(
		nodeId: string,
		rootEndpointNumber: string,
		public name: string,
		matterClient: MatterClient,
		clusterMeta: MatterDeviceCluster[],
		endpointMeta: MatterDeviceEndpoint[]
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
	}

	public getUniqueId(): string {
		return `matter:${this.#nodeId}:${this.#rootEndpointNumber}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.MATTER;
	}

	public getDeviceName(): string {
		return this.name;
	}
}
