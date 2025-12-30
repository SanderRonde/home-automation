#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import {
	BasicInformationCluster,
	BridgedDeviceBasicInformationCluster,
	GeneralCommissioning,
} from '@matter/main/clusters';
import type { Endpoint, PairedNode, RootEndpoint } from '@project-chip/matter.js/device';
import { Crypto, Environment, LogLevel, Logger, StandardCrypto } from '@matter/main';
import { ManualPairingCodeCodec, QrPairingCodeCodec } from '@matter/main/types';
import type { NodeCommissioningOptions } from '@project-chip/matter.js';
import { CommissioningController } from '@project-chip/matter.js';
import type { CommissionableDevice } from '@matter/protocol';
import { logTag } from '../../../lib/logging/logger';
import { DB_FOLDER } from '../../../lib/constants';
import type { EndpointNumber } from '@matter/main';
import type { NodeId } from '@matter/main/types';
import { MatterDevice } from '../client/device';
import { NodeJsBle } from '@matter/nodejs-ble';
import { withFn } from '../../../lib/with';
import { Data } from '../../../lib/data';
import { Ble } from '@matter/protocol';
import '@matter/nodejs-ble';
import path from 'path';

Logger.level = LogLevel.WARN;

// Use StandardCrypto (pure JS with AES-CCM polyfill) for Bun compatibility
// This avoids the ERR_CRYPTO_UNKNOWN_CIPHER error with NodeJsCrypto
if (globalThis.crypto?.subtle) {
	Environment.default.set(Crypto, new StandardCrypto(globalThis.crypto.subtle));
}

const environment = Environment.default;

type MatterDeviceInfo =
	| {
			node: PairedNode;
			endpoint: RootEndpoint;
			type: 'root';
	  }
	| {
			node: PairedNode;
			endpoint: Endpoint;
			type: 'device';
	  };

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
	private static consoleErrorFilterInstalled = false;
	private static originalConsoleError: typeof console.error | null = null;

	public devices = new Data<Record<EndpointNumber, MatterDevice>>({});

	public constructor() {
		super();

		// Install console.error filter once (static to avoid multiple installations)
		if (!MatterServer.consoleErrorFilterInstalled) {
			MatterServer.originalConsoleError = console.error;
			console.error = (...args: unknown[]) => {
				const message = args[0];
				if (
					typeof message === 'string' &&
					message.includes('AttributeDataDecoder') &&
					message.includes('chunked element')
				) {
					// Silently ignore this specific error - it's a known Matter.js issue with
					// devices sending null instead of undefined for chunked list indices
					return;
				}
				MatterServer.originalConsoleError?.apply(console, args);
			};
			MatterServer.consoleErrorFilterInstalled = true;

			// Restore original console.error when server is disposed
			this.pushDisposable(() => {
				if (MatterServer.originalConsoleError) {
					console.error = MatterServer.originalConsoleError;
					MatterServer.consoleErrorFilterInstalled = false;
					MatterServer.originalConsoleError = null;
				}
			});
		}

		// Needs to happen before the import of @matter/nodejs-ble
		environment.vars.set('ble.enable', true);
		// Explicitly register the BLE provider
		// @matter/nodejs-ble does not auto-register, so we must set Ble.get manually
		if (environment.vars.get('ble.enable')) {
			Ble.get = () => new NodeJsBle();
		}

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

	async #updateDevices(deviceInfos: MatterDeviceInfo[]) {
		const currentDevices = this.devices.current();

		// Create a reverse lookup map: uniqueId (without "matter:" prefix) -> existing device
		const devicesByUniqueId = new Map<string, MatterDevice>();
		for (const device of Object.values(currentDevices)) {
			const uniqueId = device.getUniqueId().replace(/^matter:/, '');
			devicesByUniqueId.set(uniqueId, device);
		}

		const devices: Record<string, MatterDevice> = {};
		for (const { node, endpoint, type } of deviceInfos) {
			const id = `${node.nodeId}:${endpoint.number?.toString()}`;

			const basicInfo = endpoint.getClusterClient(BasicInformationCluster);
			const bridgedInfo = endpoint.getClusterClient(BridgedDeviceBasicInformationCluster);
			const info = basicInfo ?? bridgedInfo;

			const [uniqueId, uniqueIdBridged, serialNumber] = await Promise.all([
				basicInfo?.attributes.uniqueId?.get?.(),
				bridgedInfo?.attributes.uniqueId?.get?.(),
				info?.attributes.serialNumber?.get?.(),
			]);

			const deviceUniqueId =
				uniqueId ??
				uniqueIdBridged ??
				serialNumber ??
				`${node.nodeId}:${endpoint.number ?? 0}`;

			// Try to find existing device by uniqueId (handles re-pairing with new nodeId)
			const existingDevice = devicesByUniqueId.get(deviceUniqueId);
			if (existingDevice) {
				devices[id] = existingDevice;
			} else {
				devices[id] = await MatterDevice.createDevice(
					node,
					endpoint,
					type,
					uniqueId ?? uniqueIdBridged ?? serialNumber
				);
			}
		}
		this.devices.set(devices);
	}

	private async _watchNodeIds(nodeIds: NodeId[]): Promise<PairedNode[]> {
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
		void this.#updateDevices(this.listDevices());
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
		const rootEndpoint = node.getRootEndpoint() as RootEndpoint;

		if (rootEndpoint?.number === undefined) {
			return [];
		}

		if (
			recursiveEndpoints.every(
				(endpoint) =>
					!endpoint.endpoint.getClusterClient(BridgedDeviceBasicInformationCluster)
			)
		) {
			// Non-bridged device, this is a root node, add it and its children
			return [
				{
					node: node,
					endpoint: rootEndpoint,
					type: 'root',
				},
				...rootEndpoint.getChildEndpoints().map(
					(endpoint) =>
						({
							node: node,
							endpoint,
							type: 'device',
						}) satisfies MatterDeviceInfo
				),
			];
		}

		// This node is a matter bridge. It itself and all of its
		// direct children are individual devices.
		deviceInfos.push({
			node: node,
			endpoint: rootEndpoint,
			type: 'root',
		});

		this._walkEndpoints(rootEndpoint, (endpoint) => {
			if (
				endpoint.getClusterClient(BridgedDeviceBasicInformationCluster) &&
				endpoint.number !== undefined
			) {
				deviceInfos.push({
					node: node,
					endpoint,
					type: 'device',
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
		await new Promise((resolve) => setTimeout(resolve, 5000));
		await this.#updateDevices(this.listDevices());
	}

	async discoverCommissionableDevices(
		callback: (device: CommissionableDevice) => void
	): Promise<CommissionableDevice[]> {
		return this.commissioningController.discoverCommissionableDevices(
			{},
			{
				ble: false,
			},
			callback,
			60 * 5
		);
	}

	async commissionQrCode(pairingCode: string): Promise<PairedNode[]> {
		logTag('commissioning', 'magenta', 'commissioning device with QR code', pairingCode);
		const pairingCodeCodec = QrPairingCodeCodec.decode(pairingCode)[0];
		const setupPin = pairingCodeCodec.passcode;

		const commissioningOptions: NodeCommissioningOptions['commissioning'] = {
			regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
			regulatoryCountryCode: 'NL',
		};

		const options: NodeCommissioningOptions = {
			commissioning: commissioningOptions,
			discovery: {
				identifierData: { longDiscriminator: pairingCodeCodec.discriminator },
				discoveryCapabilities: {},
			},
			passcode: setupPin,
		};

		logTag('commissioning', 'magenta', 'bumping log level to INFO');
		Logger.level = LogLevel.INFO;
		const nodeId = await withFn(
			() => {
				logTag(
					'commissioning',
					'magenta',
					'commissioning device with pairing code',
					pairingCode
				);
				return this.commissioningController.commissionNode(options);
			},
			() => {
				logTag('commissioning', 'magenta', 'bumping log level back to ERROR');
				// Logger.level = LogLevel.ERROR;
			}
		);

		logTag('commissioning', 'magenta', 'watching node ids', nodeId);
		return await this._watchNodeIds([nodeId]);
	}

	async commissionManual(pairingCode: string): Promise<PairedNode[]> {
		logTag('commissioning', 'magenta', 'commissioning device with pairing code', pairingCode);
		const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
		const shortDiscriminator = pairingCodeCodec.shortDiscriminator;
		const setupPin = pairingCodeCodec.passcode;
		if (shortDiscriminator === undefined) {
			logTag(
				'commissioning',
				'red',
				'could not commission device with pairing code',
				pairingCode
			);
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

		logTag('commissioning', 'magenta', 'bumping log level to INFO');
		Logger.level = LogLevel.INFO;
		const nodeId = await withFn(
			() => {
				logTag(
					'commissioning',
					'magenta',
					'commissioning device with pairing code',
					pairingCode
				);
				return this.commissioningController.commissionNode(options);
			},
			() => {
				logTag('commissioning', 'magenta', 'bumping log level back to ERROR');
				// Logger.level = LogLevel.ERROR;
			}
		);

		logTag('commissioning', 'magenta', 'watching node ids', nodeId);
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
		// eslint-disable-next-line n/no-process-exit
		process.exit(0);
	}
	if (process.argv.includes('--commission-qr')) {
		// eslint-disable-next-line no-console
		console.log(await controller.commissionQrCode(process.argv[3]));
		// eslint-disable-next-line n/no-process-exit
		process.exit(0);
	}
}

if (require.main === module) {
	void main();
}
