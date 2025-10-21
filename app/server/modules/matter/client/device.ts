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
import { logDev } from '../../../lib/logging/log-dev';
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
		type: 'device' | 'bridge'
	): Promise<void> {
		this.endpoints = [];
		if (type !== 'bridge') {
			// For bridges don't add child endpoints. That would lead to us adding the same endpoint
			// both as a top-level device and as a child of the bridge.
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

		// TODO:(sander) keep track of other clusters?
		this.clusters = [];
		const clusterClients = this.#endpoint.getAllClusterClients();
		for (const clusterClient of clusterClients) {
			const clusterName = clusterClient.name as keyof typeof MATTER_CLUSTERS;
			const clusterWithName = MATTER_CLUSTERS[clusterName];
			if (!clusterWithName) {
				if (!IGNORED_MATTER_CLUSTERS.includes(clusterClient.name)) {
					console.error(
						`${this.#node.nodeId}/${this.#endpoint.number}: Cluster ${clusterClient.name} not found`
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
		type: 'device' | 'bridge'
	): Promise<MatterEndpoint> {
		const matterEndpoint = new MatterEndpoint(node, endpoint);
		await matterEndpoint.init(node, endpoint, type);
		return matterEndpoint;
	}

	public getDeviceName(): Promise<string> {
		return this.#name;
	}
}

export class MatterDevice extends MatterEndpoint implements Device {
	private uniqueId: string;
	readonly #node: PairedNode;
	readonly #endpoint: Endpoint;

	private constructor(node: PairedNode, endpoint: Endpoint, uniqueId: string | undefined) {
		super(node, endpoint);
		this.#node = node;
		this.#endpoint = endpoint;
		this.uniqueId = uniqueId ?? `${node.nodeId}:${endpoint.number ?? EndpointNumber(0)}`;
	}

	public static async createDevice(
		node: PairedNode,
		endpoint: Endpoint,
		type: 'device' | 'bridge',
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

	public getManagementUrl(): string | undefined {
		// Try to generate a deep link for Philips Hue bridges
		// Hue Matter vendor ID is 0x100B (4107)
		const basicInfo = this.#endpoint.getClusterClient(BasicInformationCluster);
		if (basicInfo) {
			try {
				// Attempt to get vendor ID synchronously from cached attributes
				// This is a best-effort approach for Hue deep linking
				const vendorId = (basicInfo.attributes as any).vendorId?._value;
				if (vendorId === 0x100b || vendorId === 4107) {
					// Generate Philips Hue app deep link
					// Format: philips-hue://local/{bridgeId}
					// Using node ID as a proxy for bridge ID
					return `philips-hue://local/${this.#node.nodeId}`;
				}
			} catch (error) {
				// Silently fail if we can't determine vendor ID
			}
		}
		return undefined;
	}
}
