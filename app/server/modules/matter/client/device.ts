import {
	BasicInformationCluster,
	BridgedDeviceBasicInformationCluster,
} from '@matter/main/clusters';
import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import { MATTER_CLUSTERS, IGNORED_MATTER_CLUSTERS } from './cluster';
import type { PairedNode } from '@project-chip/matter.js/device';
import type { Endpoint } from '@project-chip/matter.js/device';
import type { ClusterClientObj } from '@matter/protocol';
import { type MatterClusterInterface } from './cluster';
import { EndpointNumber } from '@matter/types';
import type { MatterCluster } from './cluster';
import type { NodeId } from '@matter/types';

export class MatterEndpoint extends DeviceEndpoint {
	public endpoints: MatterEndpoint[] = [];
	public clusters: MatterCluster<MatterClusterInterface>[] = [];

	readonly #name: Promise<string>;
	readonly #node: PairedNode;
	readonly #endpoint: Endpoint;

	public constructor(node: PairedNode, endpoint: Endpoint) {
		super();
		this.#node = node;
		this.#endpoint = endpoint;

		this.endpoints = endpoint
			.getChildEndpoints()
			.filter((endpoint) => endpoint.number !== undefined)
			.map((endpoint) => new MatterEndpoint(node, endpoint));
		for (const childEndpoint of endpoint.getChildEndpoints()) {
			if (childEndpoint.number === undefined) {
				continue;
			}
		}

		this.clusters = [];
		for (const clusterClient of this.#endpoint.getAllClusterClients()) {
			const clusterName = clusterClient.name as keyof typeof MATTER_CLUSTERS;
			const ClusterWithName = MATTER_CLUSTERS[clusterName];
			if (!ClusterWithName) {
				if (!IGNORED_MATTER_CLUSTERS.includes(clusterClient.name)) {
					console.error(
						`${this.#node.nodeId}/${this.#endpoint.number}: Cluster ${clusterClient.name} not found`
					);
				}
				continue;
			}
			this.clusters.push(
				new ClusterWithName(
					this.#node,
					this.#endpoint,
					clusterClient as unknown as ClusterClientObj
				)
			);
		}

		this.#name = (async () => {
			return (
				(await endpoint
					.getClusterClient(BasicInformationCluster)
					?.attributes.nodeLabel?.get?.()) ||
				(await endpoint
					.getClusterClient(BridgedDeviceBasicInformationCluster)
					?.attributes.nodeLabel?.get?.()) ||
				endpoint.name ||
				'<empty>'
			);
		})();
	}

	public getDeviceName(): Promise<string> {
		return this.#name;
	}
}

export class MatterDevice extends MatterEndpoint implements Device {
	readonly #rootEndpointNumber: EndpointNumber;
	readonly #nodeId: NodeId;

	public constructor(node: PairedNode, endpoint: Endpoint) {
		super(node, endpoint);
		this.#rootEndpointNumber = endpoint.number ?? EndpointNumber(0);
		this.#nodeId = node.nodeId;
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this.#nodeId}:${this.#rootEndpointNumber}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.MATTER;
	}
}
