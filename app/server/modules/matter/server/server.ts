#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import {
	BasicInformationCluster,
	BridgedDeviceBasicInformationCluster,
	GeneralCommissioning,
} from '@matter/main/clusters';
import type {
	DeviceTypeId,
	EndpointNumber,
	Observable,
	Observer,
} from '@matter/main';
import type { Endpoint, PairedNode } from '@project-chip/matter.js/device';
import type { NodeCommissioningOptions } from '@project-chip/matter.js';
import { CommissioningController } from '@project-chip/matter.js';
import { Environment, LogLevel, Logger } from '@matter/main';
import { ManualPairingCodeCodec } from '@matter/main/types';
import type { NodeId } from '@matter/main/types';
import { MatterDevice } from '../client/device';
import { Data } from '../../../lib/data';

Logger.level = LogLevel.ERROR;

const environment = Environment.default;

interface MatterDeviceInfo {
	node: PairedNode;
	rootEndpoint: Endpoint;
	name: string;
	label: string | undefined;
	deviceType: DeviceTypeId;
	endpoints: Endpoint[];
	clusters: ClusterClientObj[];
}

export class MatterServer implements AsyncDisposable {
	readonly #commissioningController: CommissioningController;

	public devices = new Data<Record<EndpointNumber, MatterDevice>>({});

	public constructor() {
		/** Create Matter Controller Node and bind it to the Environment. */
		this.#commissioningController = new CommissioningController({
			environment: {
				environment,
				id: 'home-automation',
			},
			autoConnect: false, // Do not auto connect to the commissioned nodes
			adminFabricLabel: 'home-automation',
		});
	}

	private _nodes: PairedNode[] = [];

	private async _watchNodeIds(nodeIds: NodeId[]): Promise<string[]> {
		const nodes = await Promise.all(
			nodeIds.map((nodeId) =>
				this.#commissioningController.getNode(nodeId)
			)
		);
		nodes.forEach((node) => {
			if (!node.isConnected) {
				node.connect();
			}
		});
		await Promise.all(
			nodes.map((node) =>
				node.initialized ? Promise.resolve() : node.events.initialized
			)
		);
		this._nodes.push(...nodes);

		return nodes
			.flatMap((node) => node.getDevices())
			.map((endpoint) => endpoint.getNumber().toString());
	}

	private _walkEndpoints(
		device: Endpoint,
		callback: (endpoint: Endpoint) => boolean
	): void {
		for (const endpoint of device.getChildEndpoints()) {
			if (callback(endpoint)) {
				this._walkEndpoints(endpoint, callback);
			}
		}
	}

	private async _getDeviceInfo(
		device: Endpoint,
		node: PairedNode
	): Promise<MatterDeviceInfo | null> {
		if (device.number === undefined) {
			return null;
		}

		const nodeLabel =
			(await device
				.getClusterClient(BasicInformationCluster)
				?.attributes.nodeLabel?.get?.()) ??
			(await device
				.getClusterClient(BridgedDeviceBasicInformationCluster)
				?.attributes.nodeLabel?.get?.());

		return {
			node,
			name: device.name,
			label: nodeLabel,
			deviceType: device.deviceType,
			rootEndpoint: device,
			endpoints: device
				.getChildEndpoints()
				.filter((e) => e.number !== undefined),
			clusters: device.getAllClusterClients(),
		};
	}

	private _getRecursiveEndpoints(node: PairedNode): {
		nodeId: NodeId;
		endpoint: Endpoint;
	}[] {
		const devices: {
			nodeId: NodeId;
			endpoint: Endpoint;
		}[] = [];
		// Try to get the root device (endpoint 0) directly from the node
		const rootDevice = node.getRootEndpoint?.();
		if (rootDevice) {
			devices.push({
				nodeId: node.nodeId,
				endpoint: rootDevice,
			});
		}

		for (const device of node.getDevices()) {
			this._walkEndpoints(device, (endpoint) => {
				devices.push({
					nodeId: node.nodeId,
					endpoint,
				});
				return true;
			});
		}

		return devices;
	}

	private async _listNodeDevices(
		node: PairedNode
	): Promise<MatterDeviceInfo[]> {
		const deviceInfos: Promise<MatterDeviceInfo | null>[] = [];
		const recursiveEndpoints = this._getRecursiveEndpoints(node);
		if (
			recursiveEndpoints.every(
				(endpoint) =>
					!endpoint.endpoint.getClusterClient(
						BridgedDeviceBasicInformationCluster
					)
			)
		) {
			const rootEndpoint = node.getRootEndpoint();
			if (!rootEndpoint) {
				return [];
			}

			// This node is a normal device.
			const deviceInfo = await this._getDeviceInfo(rootEndpoint, node);
			if (deviceInfo) {
				return [deviceInfo];
			}
			return [];
		}

		// This node is a matter bridge. It itself and all of its
		// direct children are individual devices.
		const rootEndpoint = node.getRootEndpoint();
		if (rootEndpoint?.number === undefined) {
			return [];
		}

		const nodeLabel =
			(await rootEndpoint
				.getClusterClient(BasicInformationCluster)
				?.attributes.nodeLabel?.get?.()) ??
			(await rootEndpoint
				.getClusterClient(BridgedDeviceBasicInformationCluster)
				?.attributes.nodeLabel?.get?.());

		deviceInfos.push(
			Promise.resolve({
				node: node,
				name: rootEndpoint.name,
				label: nodeLabel,
				deviceType: rootEndpoint.deviceType,
				rootEndpoint,
				endpoints: [],
				clusters: rootEndpoint.getAllClusterClients(),
			})
		);

		this._walkEndpoints(rootEndpoint, (endpoint) => {
			if (
				endpoint.getClusterClient(BridgedDeviceBasicInformationCluster)
			) {
				deviceInfos.push(this._getDeviceInfo(endpoint, node));
				return false;
			}
			return true;
		});
		return (await Promise.all(deviceInfos)).filter(
			(deviceInfo) => deviceInfo !== null
		);
	}

	public async listDevices(): Promise<MatterDeviceInfo[]> {
		const deviceInfos: MatterDeviceInfo[] = [];
		for (const watchedNode of this._nodes) {
			deviceInfos.push(...(await this._listNodeDevices(watchedNode)));
		}
		return deviceInfos;
	}

	public async start(): Promise<void> {
		await this.#commissioningController.start();

		await this._watchNodeIds(
			this.#commissioningController.getCommissionedNodes()
		);

		await this.listDevices().then((devices) =>
			this.#updateDevices(devices)
		);
	}

	public async commission(pairingCode: string): Promise<string[]> {
		const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
		const shortDiscriminator = pairingCodeCodec.shortDiscriminator;
		const setupPin = pairingCodeCodec.passcode;
		if (shortDiscriminator === undefined) {
			throw new Error('Could not commission device with pairing code');
		}

		const commissioningOptions: NodeCommissioningOptions['commissioning'] =
			{
				regulatoryLocation:
					GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
				regulatoryCountryCode: 'NL',
			};

		const options: NodeCommissioningOptions = {
			commissioning: commissioningOptions,
			discovery: {
				identifierData: { shortDiscriminator },
				discoveryCapabilities: {},
			},
			passcode: setupPin,
		};

		const nodeId =
			await this.#commissioningController.commissionNode(options);

		return await this._watchNodeIds([nodeId]);
	}

	public async stop(): Promise<void> {
		await this.#commissioningController.close();
	}

	#updateDevices(deviceInfos: MatterDeviceInfo[]) {
		const devices: Record<string, MatterDevice> = {
			...this.devices.current(),
		};
		for (const deviceInfo of deviceInfos) {
			const id = `${deviceInfo.node.nodeId}:${deviceInfo.rootEndpoint.number}`;
			if (devices[id]) {
				continue;
			}

			devices[id] = new MatterDevice(
				deviceInfo.node,
				deviceInfo.rootEndpoint,
				deviceInfo.label ?? deviceInfo.name,
				deviceInfo.clusters,
				deviceInfo.endpoints
			);
		}
		this.devices.set(devices);
	}

	public [Symbol.asyncDispose](): Promise<void> {
		return this.stop();
	}
}

export type ObservableForObserver<T> =
	T extends Observable<infer U> ? Observer<U> : never;

export type ClusterClientObj = NonNullable<
	ReturnType<InstanceType<typeof Endpoint>['getClusterClientById']>
>;

async function main() {
	const controller = new MatterServer();
	await controller.start();

	if (process.argv.includes('--list-devices')) {
		void controller.listDevices().then((devices) => {
			console.log('devices:', devices);
		});
	}
}

if (require.main === module) {
	void main();
}
