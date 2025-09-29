import type {
	MatterDeviceCluster,
	MatterDeviceEndpoint,
	MatterServer,
} from '../server/server';
import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import { MATTER_CLUSTERS, IGNORED_MATTER_CLUSTERS } from './cluster';
import type { PairedNode } from '@project-chip/matter.js/device';
import { type MatterClusterInterface } from './cluster';
import type { MatterCluster } from './cluster';
import type { NodeId } from '@matter/types';
import { Endpoint } from '@matter/main';

export class MatterEndpoint extends DeviceEndpoint {
	public endpoints: MatterEndpoint[] = [];
	public clusters: MatterCluster<MatterClusterInterface>[] = [];

	readonly #node: PairedNode;
	readonly #endpoint: Endpoint;
	readonly #matterServer: MatterServer;
	readonly #clusterMeta: MatterDeviceCluster[];

	public constructor(
		node: PairedNode,
		endpoint: Endpoint,
		clusterMeta: MatterDeviceCluster[],
		matterServer: MatterServer,
		endpointMeta: MatterDeviceEndpoint[]
	) {
		super();
		this.#node = node;
		this.#endpoint = endpoint;
		this.#matterServer = matterServer;
		this.#clusterMeta = clusterMeta;
		this.endpoints = endpointMeta.map(
			(endpoint) =>
				new MatterEndpoint(
					this.#node,
					endpoint.endpoint,
					endpoint.clusterMeta,
					matterServer,
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
						`${this.#node.nodeId}/${this.#endpointNumber}: Cluster ${clusterMeta.name} not found`
					);
				}
				continue;
			}
			clusters.push(
				new ClusterWithName(
					this.#node,
					this.#endpoint,
					clusterMeta.id,
					this.#matterServer
				)
			);
		}
		return clusters;
	}
}

export class MatterDevice extends MatterEndpoint implements Device {
	readonly #rootEndpointNumber: string;
	readonly #nodeId: NodeId;

	public constructor(
		node: PairedNode,
		rootEndpointNumber: string,
		public name: string,
		matterServer: MatterServer,
		clusterMeta: MatterDeviceCluster[],
		endpointMeta: MatterDeviceEndpoint[]
	) {
		super(
			node,
			rootEndpointNumber,
			clusterMeta,
			matterServer,
			endpointMeta
		);
		this.#rootEndpointNumber = rootEndpointNumber;
		this.#nodeId = node.nodeId;
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this.#nodeId}:${this.#rootEndpointNumber}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.MATTER;
	}

	public getDeviceName(): string {
		return this.name;
	}
}
