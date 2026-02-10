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
import { logReady, logTag } from '../../../lib/logging/logger';
import type { CommissionableDevice } from '@matter/protocol';
import { NodeStates } from '@project-chip/matter.js/device';
import { DB_FOLDER } from '../../../lib/constants';
import type { EndpointNumber } from '@matter/main';
import type { NodeId } from '@matter/main/types';
import { MatterDevice } from '../client/device';
import { NodeJsBle } from '@matter/nodejs-ble';
import { withFn } from '../../../lib/with';
import { wait } from '../../../lib/time';
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
	private commissioningController: CommissioningController | null = null;
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

		process.on('SIGINT', () => {
			return this.commissioningController?.close();
		});
	}

	private _nodes: PairedNode[] = [];
	private _reconnectMap = new Map<string, NodeId>();

	async #updateDevices(deviceInfos: MatterDeviceInfo[]) {
		const currentDevices = this.devices.current();

		// Create a reverse lookup map: uniqueId (without "matter:" prefix) -> existing device
		const devicesByUniqueId = new Map<string, MatterDevice>();
		for (const device of Object.values(currentDevices)) {
			const uniqueId = device.getUniqueId().replace(/^matter:/, '');
			devicesByUniqueId.set(uniqueId, device);
		}

		const devices: Record<string, MatterDevice> = {};

		// Update devices inbetween in case pairing takes a long time
		const interval = setInterval(() => {
			if (
				Object.keys(currentDevices).length === 0 &&
				Object.keys(this.devices.current()).length !== Object.keys(devices).length
			) {
				logTag('matter', 'magenta', 'updating devices (interval)');
				this.devices.set({ ...devices });
			}
		}, 1000 * 5);

		for (const { node, endpoint, type } of deviceInfos) {
			const id = `${node.nodeId}:${endpoint.number?.toString()}`;
			await Promise.race([
				(async () => {
					const basicInfo = endpoint.getClusterClient(BasicInformationCluster);
					const bridgedInfo = endpoint.getClusterClient(
						BridgedDeviceBasicInformationCluster
					);
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
				})().then(
					() => {
						logTag('matter', 'magenta', 'device updated', id);
					},
					(error: unknown) => {
						logTag('matter', 'red', 'error updating device', id, error);
					}
				),
				wait(1000 * 60),
			]);
			const device = devices[id];
			if (device) {
				this._reconnectMap.set(device.getUniqueId(), node.nodeId);
			}
		}
		clearInterval(interval);
		this.devices.set({ ...devices });
	}

	private async _watchNodeIds(
		controller: CommissioningController,
		nodeIds: NodeId[]
	): Promise<PairedNode[]> {
		const nodes = await Promise.all(nodeIds.map((nodeId) => controller.getNode(nodeId)));
		nodes.forEach((node) => {
			if (!node.isConnected) {
				node.connect();
			}
		});
		// Wait for each node to be ready: prefer full remote init, with timeout so offline nodes don't block
		const nodeReadyTimeoutMs = 45_000;
		await Promise.all(
			nodes.map((node) =>
				Promise.race([
					node.remoteInitializationDone
						? Promise.resolve()
						: Promise.resolve(node.events.initializedFromRemote),
					wait(nodeReadyTimeoutMs),
				])
			)
		);

		for (const node of nodes) {
			node.events.structureChanged.on(this._onStructureChanged);
			const onStateChanged = (state: NodeStates) => {
				// Refresh device list when a node (re)connects so late or reconnected devices appear
				if (state === NodeStates.Connected) {
					void this.#updateDevices(this.listDevices());
				}
			};
			node.events.stateChanged.on(onStateChanged);
			// #endregion
			this.pushDisposable(() => {
				node.events.structureChanged.off(this._onStructureChanged);
				node.events.stateChanged.off(onStateChanged);
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
			try {
				deviceInfos.push(...this._listNodeDevices(watchedNode));
			} catch (error) {
				logTag(
					'matter',
					'red',
					'listDevices: skip node',
					String(watchedNode.nodeId),
					error
				);
			}
		}
		return deviceInfos;
	}

	async getCommissionedNodesInfo(): Promise<
		{ nodeId: string; name: string; clusters: string[] }[]
	> {
		if (!this.commissioningController) {
			return [];
		}
		const nodeIds = this.commissioningController.getCommissionedNodes();
		const result: { nodeId: string; name: string; clusters: string[] }[] = [];
		for (const nodeId of nodeIds) {
			const nodeIdStr = String(nodeId);
			const node = this._nodes.find((n) => n.nodeId === nodeId);
			let name = `Node ${nodeIdStr}`;
			const clusters: string[] = [];
			if (node) {
				try {
					const root = node.getRootEndpoint();
					const basicInfo = root?.getClusterClient(BasicInformationCluster);
					const bridgedInfo = root?.getClusterClient(
						BridgedDeviceBasicInformationCluster
					);
					const info = basicInfo ?? bridgedInfo;
					const [nodeLabel, productLabel, productName, vendorName, serialNumber] =
						await Promise.all([
							info?.attributes.nodeLabel?.get?.(),
							info?.attributes.productLabel?.get?.(),
							info?.attributes.productName?.get?.(),
							info?.attributes.vendorName?.get?.(),
							info?.attributes.serialNumber?.get?.(),
						]);
					const trim = (s: unknown) =>
						typeof s === 'string' && s.trim().length > 0 ? s.trim() : undefined;
					const v = trim(vendorName);
					const p = trim(productName);
					const label =
						trim(nodeLabel) ??
						trim(productLabel) ??
						p ??
						(v && p ? `${v} ${p}` : v) ??
						trim(serialNumber) ??
						root?.name;
					if (label) {
						name = label;
					}
					if (root) {
						const clients = root.getAllClusterClients?.() ?? [];
						for (const client of clients) {
							if (client?.name && typeof client.name === 'string') {
								clusters.push(client.name);
							}
						}
						clusters.sort((a, b) => a.localeCompare(b));
					}
				} catch {
					// Keep Node ${nodeIdStr} and empty clusters
				}
			}
			result.push({ nodeId: nodeIdStr, name, clusters });
		}
		return result;
	}

	async removeNode(nodeIdParam: string): Promise<void> {
		if (!this.commissioningController) {
			throw new Error('Matter controller not started');
		}
		const nodeIds = this.commissioningController.getCommissionedNodes();
		const nodeId = nodeIds.find((id) => String(id) === nodeIdParam);
		if (nodeId === undefined) {
			throw new Error('Node not found');
		}
		await this.commissioningController.removeNode(nodeId);
		this._nodes = this._nodes.filter((n) => n.nodeId !== nodeId);
		await this.#updateDevices(this.listDevices());
	}

	async start(): Promise<void> {
		/** Create Matter Controller Node and bind it to the Environment. */
		this.commissioningController = new CommissioningController({
			environment: {
				environment,
				id: 'home-automation',
			},
			autoConnect: false, // Do not auto connect to the commissioned nodes
			adminFabricLabel: 'home-automation',
		});

		logTag('matter', 'magenta', 'starting matter server');
		await this.commissioningController.start();

		logTag('matter', 'magenta', 'watching node ids');
		await this._watchNodeIds(
			this.commissioningController,
			this.commissioningController.getCommissionedNodes()
		);
		await new Promise((resolve) => setTimeout(resolve, 5000));
		logTag('matter', 'magenta', 'listing devices');
		const devices = this.listDevices();
		logTag('matter', 'magenta', 'updating devices');
		await this.#updateDevices(devices);
		logTag('matter', 'magenta', 'matter server started');
	}

	async discoverCommissionableDevices(
		callback: (device: CommissionableDevice) => void
	): Promise<CommissionableDevice[]> {
		if (!this.commissioningController) {
			return [];
		}
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
		if (!this.commissioningController) {
			return [];
		}
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
		const controller = this.commissioningController;
		Logger.level = LogLevel.INFO;
		const nodeId = await withFn(
			() => {
				logTag(
					'commissioning',
					'magenta',
					'commissioning device with pairing code',
					pairingCode
				);
				return controller.commissionNode(options);
			},
			() => {
				logTag('commissioning', 'magenta', 'bumping log level back to ERROR');
				// Logger.level = LogLevel.ERROR;
			}
		);

		logTag('commissioning', 'magenta', 'watching node ids', String(nodeId));
		return await this._watchNodeIds(controller, [nodeId]);
	}

	async commissionManual(pairingCode: string): Promise<PairedNode[]> {
		if (!this.commissioningController) {
			return [];
		}
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
		const controller = this.commissioningController;
		const nodeId = await withFn(
			() => {
				logTag(
					'commissioning',
					'magenta',
					'commissioning device with pairing code',
					pairingCode
				);
				return controller.commissionNode(options);
			},
			() => {
				logTag('commissioning', 'magenta', 'bumping log level back to ERROR');
				// Logger.level = LogLevel.ERROR;
			}
		);

		logTag('commissioning', 'magenta', 'watching node ids', String(nodeId));
		return await this._watchNodeIds(controller, [nodeId]);
	}

	async reconnectDevice(deviceId: string): Promise<void> {
		const nodeId = this._reconnectMap.get(deviceId);
		if (nodeId === undefined) {
			throw new Error('Device not found');
		}
		if (!this.commissioningController) {
			throw new Error('Matter controller not started');
		}
		const node = await this.commissioningController.getNode(nodeId);
		logTag('matter', 'magenta', 'reconnecting device', deviceId, 'nodeId', String(nodeId));
		node.connect();
	}

	async stop(): Promise<void> {
		if (this.commissioningController) {
			await this.commissioningController.close();
			this.commissioningController = null;
		}
	}

	async restart(): Promise<void> {
		await this.stop();
		await this.start();
	}
}

async function main() {
	const controller = new MatterServer();
	await controller.start();

	if (process.argv.includes('--list-devices')) {
		logReady();
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
