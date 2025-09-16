import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import type { Endpoint, PairedNode } from '@project-chip/matter.js/device';
import { MATTER_CLUSTERS, IGNORED_MATTER_CLUSTERS } from './cluster';
import type { ClusterClientObj } from '../server/server';
import { type MatterClusterInterface } from './cluster';
import type { MatterCluster } from './cluster';
import type { NodeId } from '@matter/types';

export class MatterEndpoint extends DeviceEndpoint {
	public endpoints: MatterEndpoint[] = [];
	public clusters: MatterCluster<MatterClusterInterface>[] = [];

	readonly #node: PairedNode;
	readonly #endpoint: Endpoint;
	readonly #clusters: ClusterClientObj[];

	public constructor(
		node: PairedNode,
		endpoint: Endpoint,
		clusters: ClusterClientObj[],
		endpoints: Endpoint[]
	) {
		super();
		this.#node = node;
		this.#endpoint = endpoint;
		this.#clusters = clusters;
		this.endpoints = endpoints.map(
			(endpoint) =>
				new MatterEndpoint(
					this.#node,
					endpoint,
					endpoint.getAllClusterClients(),
					endpoint
						.getChildEndpoints()
						.filter((e) => e.number !== undefined)
				)
		);
		this.clusters = this._getClusters();
	}

	protected _getClusters(): MatterCluster<MatterClusterInterface>[] {
		const clusters: MatterCluster<MatterClusterInterface>[] = [];
		for (const cluster of this.#clusters) {
			const ClusterWithName =
				cluster.name in MATTER_CLUSTERS
					? MATTER_CLUSTERS[
							cluster.name as keyof typeof MATTER_CLUSTERS
						]
					: null;
			if (!ClusterWithName) {
				if (!IGNORED_MATTER_CLUSTERS.includes(cluster.name)) {
					console.error(
						`${this.#node.nodeId}/${this.#endpoint.number}: Cluster ${cluster.name} not found`
					);
				}
				continue;
			}
			clusters.push(new ClusterWithName(this.#node, cluster));
		}
		return clusters;
	}
}

export class MatterDevice extends MatterEndpoint implements Device {
	readonly #rootEndpoint: Endpoint;
	readonly #nodeId: NodeId;

	public constructor(
		node: PairedNode,
		rootEndpoint: Endpoint,
		public name: string,
		clusters: ClusterClientObj[],
		endpoints: Endpoint[]
	) {
		super(node, rootEndpoint, clusters, endpoints);
		this.#rootEndpoint = rootEndpoint;
		this.#nodeId = node.nodeId;
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this.#nodeId}:${this.#rootEndpoint.number}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.MATTER;
	}

	public getDeviceName(): string {
		return this.name;
	}
}
