import {
	BasicInformationCluster,
	BridgedDeviceBasicInformationCluster,
} from '@matter/main/clusters';
import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import { MATTER_CLUSTERS, IGNORED_MATTER_CLUSTERS } from './cluster';
import type { PairedNode } from '@project-chip/matter.js/device';
import type { Endpoint } from '@project-chip/matter.js/device';
import { EventEmitter } from '../../../lib/event-emitter';
import { type MatterClusterInterface } from './cluster';
import { EndpointNumber } from '@matter/types';
import type { MatterCluster } from './cluster';

export class MatterEndpoint extends DeviceEndpoint {
	public endpoints: MatterEndpoint[] = [];
	public clusters: MatterCluster<MatterClusterInterface>[] = [];
	public readonly onChange: EventEmitter<void> = new EventEmitter();

	readonly #name: Promise<string>;
	readonly #node: PairedNode;
	readonly #endpoint: Endpoint;

	protected constructor(node: PairedNode, endpoint: Endpoint) {
		super();
		this.#node = node;
		this.#endpoint = endpoint;

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

	protected async init(
		node: PairedNode,
		endpoint: Endpoint,
		type: 'device' | 'root'
	): Promise<void> {
		this.endpoints = [];
		if (type !== 'root') {
			// For root nodes don't add child endpoints. That would lead to us adding the same endpoint
			// both as a top-level device and as a child of the root node.
			for (const childEndpoint of endpoint.getChildEndpoints()) {
				if (childEndpoint.number === undefined) {
					continue;
				}
				const matterEndpoint = await MatterEndpoint.createEndpoint(
					node,
					childEndpoint,
					'device'
				);
				matterEndpoint.onChange.listen(() => this.onChange.emit(undefined));
				this.endpoints.push(matterEndpoint);
			}
		}

		this.clusters = [];
		const clusterClients = this.#endpoint.getAllClusterClients();
		for (const clusterClient of clusterClients) {
			const clusterName = clusterClient.name as keyof typeof MATTER_CLUSTERS;
			const clusterWithName = MATTER_CLUSTERS[clusterName];
			if (!clusterWithName) {
				if (!IGNORED_MATTER_CLUSTERS.includes(clusterClient.name)) {
					console.error(
						`${this.#node.nodeId}/${this.#endpoint.number}/${await this.#name}: Cluster ${clusterClient.name} not found`
					);
				}
				continue;
			}
			const cluster = await clusterWithName(
				this.#node,
				this.#endpoint,
				clusterClient,
				clusterClients
			);
			if (!cluster) {
				continue;
			}
			cluster.onChange.listen(() => this.onChange.emit(undefined));
			this.clusters.push(cluster);
		}
	}

	public static async createEndpoint(
		node: PairedNode,
		endpoint: Endpoint,
		type: 'device' | 'root'
	): Promise<MatterEndpoint> {
		const matterEndpoint = new MatterEndpoint(node, endpoint);
		await matterEndpoint.init(node, endpoint, type);
		return matterEndpoint;
	}

	public getDeviceName(): Promise<string> {
		return this.#name;
	}

	public getDeviceStatus(): 'online' | 'offline' {
		return 'online';
	}
}

export class MatterDevice extends MatterEndpoint implements Device {
	private uniqueId: string;
	readonly #managementUrl: Promise<string | undefined>;

	private constructor(node: PairedNode, endpoint: Endpoint, uniqueId: string | undefined) {
		super(node, endpoint);
		this.uniqueId = uniqueId ?? `${node.nodeId}:${endpoint.number ?? EndpointNumber(0)}`;
		this.#managementUrl = (async () => {
			const info =
				endpoint.getClusterClient(BasicInformationCluster) ??
				endpoint.getClusterClient(BridgedDeviceBasicInformationCluster);
			if (!info) {
				return undefined;
			}
			const vendorId = await info.attributes.vendorId?.get?.();
			if (!vendorId) {
				return undefined;
			}
			// If Philips Hue, return custom hue URL scheme
			// Philips Hue vendorId is 4107 decimal (0x100B)
			if (vendorId === 4107 || vendorId === 0x100b) {
				// This instantly redirects to the home page. There is no direct link
				// there so we use this.
				return 'hue://show_test_settings/';
			}
			return undefined;
		})();
	}

	public static async createDevice(
		node: PairedNode,
		endpoint: Endpoint,
		type: 'device' | 'root',
		uniqueId: string | undefined
	): Promise<MatterDevice> {
		const matterDevice = new MatterDevice(node, endpoint, uniqueId);
		matterDevice.uniqueId =
			uniqueId ?? `${node.nodeId}:${endpoint.number ?? EndpointNumber(0)}`;
		await matterDevice.init(node, endpoint, type);
		return matterDevice;
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this.uniqueId}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.MATTER;
	}

	public getManagementUrl(): Promise<string | undefined> {
		return this.#managementUrl;
	}
}
