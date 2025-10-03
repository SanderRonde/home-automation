#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { BridgedDeviceBasicInformationCluster, GeneralCommissioning } from '@matter/main/clusters';
import { Crypto, Environment, LogLevel, Logger, StandardCrypto } from '@matter/main';
import type { Endpoint, PairedNode } from '@project-chip/matter.js/device';
import type { NodeCommissioningOptions } from '@project-chip/matter.js';
import { CommissioningController } from '@project-chip/matter.js';
import { ManualPairingCodeCodec } from '@matter/main/types';
import { logDev } from '../../../lib/logging/log-dev';
import { DB_FOLDER } from '../../../lib/constants';
import type { EndpointNumber } from '@matter/main';
import type { NodeId } from '@matter/main/types';
import { MatterDevice } from '../client/device';
import { Data } from '../../../lib/data';
import path from 'path';

Logger.level = LogLevel.ERROR;

// Use StandardCrypto (pure JS with AES-CCM polyfill) for Bun compatibility
// This avoids the ERR_CRYPTO_UNKNOWN_CIPHER error with NodeJsCrypto
if (globalThis.crypto?.subtle) {
	Environment.default.set(Crypto, new StandardCrypto(globalThis.crypto.subtle));
}

const environment = Environment.default;

interface MatterDeviceInfo {
	node: PairedNode;
	endpoint: Endpoint;
}

class Disposable {
	private _disposables: (() => void)[] = [];

	public dispose() {
		this._disposables.forEach((dispose) => dispose());
		this._disposables.length = 0;
	}

	public pushDisposable(dispose: () => void) {
		this._disposables.push(dispose);
	}
}

export class MatterServer extends Disposable {
	private readonly commissioningController: CommissioningController;

	public devices = new Data<Record<EndpointNumber, MatterDevice>>({});

	public constructor() {
		super();

		environment.vars.set('storage.path', path.join(DB_FOLDER, 'matter'));

		/** Create Matter Controller Node and bind it to the Environment. */
		this.commissioningController = new CommissioningController({
			environment: {
				environment,
				id: 'home-automation',
			},
			autoConnect: false, // Do not auto connect to the commissioned nodes
			adminFabricLabel: 'home-automation',
		});
	}

	private _nodes: PairedNode[] = [];

	#updateDevices(deviceInfos: MatterDeviceInfo[]) {
		const devices: Record<string, MatterDevice> = {
			...this.devices.current(),
		};
		for (const { node, endpoint } of deviceInfos) {
			const id = `${node.nodeId}:${endpoint.number?.toString()}`;
			if (devices[id]) {
				continue;
			}

			devices[id] = new MatterDevice(node, endpoint);
		}
		this.devices.set(devices);
	}

	private async _watchNodeIds(nodeIds: NodeId[]): Promise<PairedNode[]> {
		logDev('Watching node ids:', nodeIds);
		const nodes = await Promise.all(
			nodeIds.map((nodeId) => this.commissioningController.getNode(nodeId))
		);
		nodes.forEach((node) => {
			if (!node.isConnected) {
				node.connect();
			}
		});
		await Promise.all(
			nodes.map((node) => (node.initialized ? Promise.resolve() : node.events.initialized))
		);

		for (const node of nodes) {
			node.events.structureChanged.on(this._onStructureChanged);
			this.pushDisposable(() => {
				node.events.structureChanged.off(this._onStructureChanged);
			});
		}
		this._nodes.push(...nodes);
		return nodes;
	}

	private readonly _onStructureChanged = () => {
		this.#updateDevices(this.listDevices());
	};

	private _walkEndpoints(device: Endpoint, callback: (endpoint: Endpoint) => boolean): void {
		for (const endpoint of device.getChildEndpoints()) {
			if (callback(endpoint)) {
				this._walkEndpoints(endpoint, callback);
			}
		}
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

	private _listNodeDevices(node: PairedNode): MatterDeviceInfo[] {
		const deviceInfos: MatterDeviceInfo[] = [];
		const recursiveEndpoints = this._getRecursiveEndpoints(node);
		if (
			recursiveEndpoints.every(
				(endpoint) =>
					!endpoint.endpoint.getClusterClient(BridgedDeviceBasicInformationCluster)
			)
		) {
			const rootEndpoint = node.getRootEndpoint();
			if (rootEndpoint?.number === undefined) {
				return [];
			}

			// This node is a normal device.
			return [
				{
					node: node,
					endpoint: rootEndpoint,
				},
			];
		}

		// This node is a matter bridge. It itself and all of its
		// direct children are individual devices.
		const rootEndpoint = node.getRootEndpoint();
		if (rootEndpoint?.number === undefined) {
			return [];
		}

		deviceInfos.push({
			node: node,
			endpoint: rootEndpoint,
		});

		this._walkEndpoints(rootEndpoint, (endpoint) => {
			if (
				endpoint.getClusterClient(BridgedDeviceBasicInformationCluster) &&
				endpoint.number !== undefined
			) {
				deviceInfos.push({
					node: node,
					endpoint,
				});
				return false;
			}
			return true;
		});
		return deviceInfos;
	}

	public listDevices(): MatterDeviceInfo[] {
		const deviceInfos: MatterDeviceInfo[] = [];
		for (const watchedNode of this._nodes) {
			deviceInfos.push(...this._listNodeDevices(watchedNode));
		}
		return deviceInfos;
	}

	async start(): Promise<void> {
		await this.commissioningController.start();

		await this._watchNodeIds(this.commissioningController.getCommissionedNodes());
		this.#updateDevices(this.listDevices());
	}

	async commission(pairingCode: string): Promise<PairedNode[]> {
		const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
		const shortDiscriminator = pairingCodeCodec.shortDiscriminator;
		const setupPin = pairingCodeCodec.passcode;
		if (shortDiscriminator === undefined) {
			throw new Error('Could not commission device with pairing code');
		}

		const commissioningOptions: NodeCommissioningOptions['commissioning'] = {
			regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
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

		const nodeId = await this.commissioningController.commissionNode(options);

		return await this._watchNodeIds([nodeId]);
	}

	async stop(): Promise<void> {
		await this.commissioningController.close();
	}
}

async function main() {
	const controller = new MatterServer();
	await controller.start();

	if (process.argv.includes('--list-devices')) {
		const devices = controller.listDevices();
		// eslint-disable-next-line no-console
		console.log('devices:', devices);
	}
}

if (require.main === module) {
	void main();
}
