#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import {
	BasicInformationCluster,
	BridgedDeviceBasicInformationCluster,
	GeneralCommissioning,
} from '@matter/main/clusters';
import type {
	ClusterId,
	DeviceTypeId,
	Observable,
	Observer,
} from '@matter/main';
import type { Endpoint, PairedNode } from '@project-chip/matter.js/device';
import { Diagnostic, Environment, LogLevel, Logger } from '@matter/main';
import type { NodeCommissioningOptions } from '@project-chip/matter.js';
import { CommissioningController } from '@project-chip/matter.js';
import { NodeStates } from '@project-chip/matter.js/device';
import { ManualPairingCodeCodec } from '@matter/main/types';
import type { NodeId } from '@matter/main/types';

Logger.level = LogLevel.ERROR;

const environment = Environment.default;

export enum MatterServerOutputMessageType {
	Response = 'response',
	AttributeChanged = 'attributeChanged',
	EventTriggered = 'eventTriggered',
	StructureChanged = 'structureChanged',
	StateChanged = 'stateChanged',
}

export type MatterServerOutputMessage =
	| {
			category: MatterServerOutputMessageType.Response;
			identifier: number;
			response: unknown;
	  }
	| {
			category: MatterServerOutputMessageType.AttributeChanged;
			nodeId: string;
			attributePath: string[];
			newValue: unknown;
	  }
	| {
			category: MatterServerOutputMessageType.EventTriggered;
			nodeId: string;
			eventPath: string[];
			eventData: unknown;
	  }
	| {
			category: MatterServerOutputMessageType.StructureChanged;
			nodeId: string;
	  }
	| {
			category: MatterServerOutputMessageType.StateChanged;
			nodeId: string;
			newState: string;
	  };

export interface MatterDeviceCluster {
	name: string;
	id: ClusterId;
}

export interface MatterDeviceEndpoint {
	number: string;
	name: string;
	deviceType: DeviceTypeId;
	endpoints: MatterDeviceEndpoint[];
	clusterMeta: MatterDeviceCluster[];
}

export interface MatterDeviceInfo {
	nodeId: string;
	number: string;
	name: string;
	label: string | undefined;
	deviceType: DeviceTypeId;
	endpoints: MatterDeviceEndpoint[];
	clusterMeta: MatterDeviceCluster[];
}

export enum MatterServerInputMessageType {
	ListDevices = 'listDevices',
	PairWithCode = 'pairWithCode',
	GetAttribute = 'getAttribute',
	SetAttribute = 'setAttribute',
	CallCluster = 'callCluster',
}

export interface MatterServerInputParameters {
	[MatterServerInputMessageType.ListDevices]: [];
	[MatterServerInputMessageType.PairWithCode]: [code: string];
	[MatterServerInputMessageType.GetAttribute]: [
		nodeId: string,
		endpointNumber: string,
		clusterId: ClusterId,
		attributeName: string,
	];
	[MatterServerInputMessageType.SetAttribute]: [
		nodeId: string,
		endpointNumber: string,
		clusterId: ClusterId,
		attributeName: string,
		value: unknown,
	];
	[MatterServerInputMessageType.CallCluster]: [
		nodeId: string,
		endpointNumber: string,
		clusterId: ClusterId,
		commandName: string,
		args: unknown[],
	];
}

export type MatterServerInputMessage =
	| {
			type: MatterServerInputMessageType.ListDevices;
			arguments: MatterServerInputParameters[MatterServerInputMessageType.ListDevices];
	  }
	| {
			type: MatterServerInputMessageType.PairWithCode;
			arguments: MatterServerInputParameters[MatterServerInputMessageType.PairWithCode];
	  }
	| {
			type: MatterServerInputMessageType.GetAttribute;
			arguments: MatterServerInputParameters[MatterServerInputMessageType.GetAttribute];
	  }
	| {
			type: MatterServerInputMessageType.SetAttribute;
			arguments: MatterServerInputParameters[MatterServerInputMessageType.SetAttribute];
	  }
	| {
			type: MatterServerInputMessageType.CallCluster;
			arguments: MatterServerInputParameters[MatterServerInputMessageType.CallCluster];
	  };

export interface MatterServerInputReturnValues {
	[MatterServerInputMessageType.ListDevices]: MatterDeviceInfo[];
	[MatterServerInputMessageType.PairWithCode]: string[];
	[MatterServerInputMessageType.GetAttribute]: unknown;
	[MatterServerInputMessageType.CallCluster]: unknown;
	[MatterServerInputMessageType.SetAttribute]: void;
}

class MatterServer {
	private readonly commissioningController: CommissioningController;

	public constructor() {
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

	private _nodes: NodeWatcher[] = [];

	private async _watchNodeIds(nodeIds: NodeId[]): Promise<string[]> {
		const nodes = await Promise.all(
			nodeIds.map((nodeId) =>
				this.commissioningController.getNode(nodeId)
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
		this._nodes.push(...nodes.map((node) => new NodeWatcher(node)));

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
		nodeId: NodeId
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

		const collectRecursiveEndpoints = (
			device: Endpoint
		): MatterDeviceEndpoint[] => {
			const endpoints: MatterDeviceEndpoint[] = [];
			for (const endpoint of device.getChildEndpoints()) {
				if (endpoint.number === undefined) {
					continue;
				}
				const endpointInfo = {
					number: endpoint.number.toString(),
					name: endpoint.name,
					deviceType: endpoint.deviceType,
					clusterMeta: endpoint
						.getAllClusterClients()
						.map((clusterClient) => ({
							name: clusterClient.name,
							id: clusterClient.id,
						})),
				};
				endpoints.push({
					...endpointInfo,
					endpoints: collectRecursiveEndpoints(endpoint),
				});
			}
			return endpoints;
		};

		return {
			nodeId: nodeId.toString(),
			name: device.name,
			label: nodeLabel,
			deviceType: device.deviceType,
			number: device.number.toString(),
			endpoints: collectRecursiveEndpoints(device),
			clusterMeta: device.getAllClusterClients().map((clusterClient) => ({
				name: clusterClient.name,
				id: clusterClient.id,
			})),
		};
	}

	private _getRecursiveEndpoints(watchedNode: NodeWatcher): {
		nodeId: NodeId;
		endpoint: Endpoint;
	}[] {
		const devices: {
			nodeId: NodeId;
			endpoint: Endpoint;
		}[] = [];
		// Try to get the root device (endpoint 0) directly from the node
		const rootDevice = watchedNode.node.getRootEndpoint?.();
		if (rootDevice) {
			devices.push({
				nodeId: watchedNode.node.nodeId,
				endpoint: rootDevice,
			});
		}

		for (const device of watchedNode.node.getDevices()) {
			this._walkEndpoints(device, (endpoint) => {
				devices.push({
					nodeId: watchedNode.node.nodeId,
					endpoint,
				});
				return true;
			});
		}

		return devices;
	}

	private async _listNodeDevices(
		watchedNode: NodeWatcher
	): Promise<MatterDeviceInfo[]> {
		const deviceInfos: Promise<MatterDeviceInfo | null>[] = [];
		const recursiveEndpoints = this._getRecursiveEndpoints(watchedNode);
		if (
			recursiveEndpoints.every(
				(endpoint) =>
					!endpoint.endpoint.getClusterClient(
						BridgedDeviceBasicInformationCluster
					)
			)
		) {
			const rootEndpoint = watchedNode.node.getRootEndpoint();
			if (!rootEndpoint) {
				return [];
			}

			// This node is a normal device.
			const deviceInfo = await this._getDeviceInfo(
				rootEndpoint,
				watchedNode.node.nodeId
			);
			if (deviceInfo) {
				return [deviceInfo];
			}
			return [];
		}

		// This node is a matter bridge. It itself and all of its
		// direct children are individual devices.
		const rootEndpoint = watchedNode.node.getRootEndpoint();
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
				nodeId: watchedNode.node.nodeId.toString(),
				name: rootEndpoint.name,
				label: nodeLabel,
				deviceType: rootEndpoint.deviceType,
				number: rootEndpoint.number.toString(),
				endpoints: [],
				clusterMeta: rootEndpoint
					.getAllClusterClients()
					.map((clusterClient) => ({
						name: clusterClient.name,
						id: clusterClient.id,
					})),
			})
		);

		this._walkEndpoints(rootEndpoint, (endpoint) => {
			if (
				endpoint.getClusterClient(BridgedDeviceBasicInformationCluster)
			) {
				deviceInfos.push(
					this._getDeviceInfo(endpoint, watchedNode.node.nodeId)
				);
				return false;
			}
			return true;
		});
		return (await Promise.all(deviceInfos)).filter(
			(deviceInfo) => deviceInfo !== null
		);
	}

	private async _listDevices(): Promise<MatterDeviceInfo[]> {
		const deviceInfos: MatterDeviceInfo[] = [];
		for (const watchedNode of this._nodes) {
			deviceInfos.push(...(await this._listNodeDevices(watchedNode)));
		}
		return deviceInfos;
	}

	private async _getAttribute(
		nodeId: string,
		endpointNumber: string,
		clusterId: ClusterId,
		attributeName: string
	): Promise<unknown> {
		const result = this._nodes
			.flatMap(this._getRecursiveEndpoints.bind(this))
			.find(
				(endpoint) =>
					endpoint.endpoint.number?.toString() === endpointNumber &&
					endpoint.nodeId.toString() === nodeId
			);
		if (!result) {
			throw new Error('Endpoint not found');
		}
		const cluster = result.endpoint.getClusterClientById(clusterId);
		if (!cluster) {
			throw new Error('Cluster not found');
		}
		const attribute = cluster.attributes[attributeName];
		if (!attribute) {
			throw new Error('Attribute not found');
		}
		return attribute.get();
	}

	private async _setAttribute(
		nodeId: string,
		endpointNumber: string,
		clusterId: ClusterId,
		attributeName: string,
		value: unknown
	): Promise<unknown> {
		const result = this._nodes
			.flatMap(this._getRecursiveEndpoints.bind(this))
			.find(
				(endpoint) =>
					endpoint.endpoint.number?.toString() === endpointNumber &&
					endpoint.nodeId.toString() === nodeId
			);
		if (!result) {
			throw new Error('Endpoint not found');
		}
		const cluster = result.endpoint.getClusterClientById(clusterId);
		if (!cluster) {
			throw new Error('Cluster not found');
		}
		const attribute = cluster.attributes[attributeName];
		if (!attribute) {
			throw new Error('Attribute not found');
		}
		return attribute.set(value);
	}

	private async _callCluster(
		nodeId: string,
		endpointNumber: string,
		clusterId: ClusterId,
		commandName: string,
		args: unknown[]
	): Promise<unknown> {
		const result = this._nodes
			.flatMap(this._getRecursiveEndpoints.bind(this))
			.find(
				(endpoint) =>
					endpoint.endpoint.number?.toString() === endpointNumber &&
					endpoint.nodeId.toString() === nodeId
			);
		if (!result) {
			throw new Error('Endpoint not found');
		}
		const cluster = result.endpoint.getClusterClientById(clusterId);
		if (!cluster) {
			throw new Error('Cluster not found');
		}
		const command = cluster.commands[commandName];
		if (!command) {
			throw new Error('Command not found');
		}
		return (command as (...args: unknown[]) => Promise<unknown>)(...args);
	}

	async start() {
		await this.commissioningController.start();

		await this._watchNodeIds(
			this.commissioningController.getCommissionedNodes()
		);
	}

	async commission(pairingCode: string) {
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
			await this.commissioningController.commissionNode(options);

		return await this._watchNodeIds([nodeId]);
	}

	async stop() {
		await this.commissioningController.close();
	}

	async onMessage(
		message: MatterServerInputMessage
	): Promise<MatterServerInputReturnValues[(typeof message)['type']]> {
		switch (message.type) {
			case MatterServerInputMessageType.ListDevices:
				return this._listDevices();
			case MatterServerInputMessageType.PairWithCode:
				return this.commission(message.arguments[0]);
			case MatterServerInputMessageType.GetAttribute:
				return this._getAttribute(
					message.arguments[0],
					message.arguments[1],
					message.arguments[2],
					message.arguments[3]
				);
			case MatterServerInputMessageType.SetAttribute:
				return await this._setAttribute(
					message.arguments[0],
					message.arguments[1],
					message.arguments[2],
					message.arguments[3],
					message.arguments[4]
				);
			case MatterServerInputMessageType.CallCluster:
				return this._callCluster(
					message.arguments[0],
					message.arguments[1],
					message.arguments[2],
					message.arguments[3],
					message.arguments[4]
				);
		}
	}
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

class NodeWatcher extends Disposable {
	public constructor(public readonly node: PairedNode) {
		super();
		this._listen();
	}

	private _listen() {
		// Subscribe to events of the node
		this.node.events.attributeChanged.on(this.attributeChanged);
		this.node.events.eventTriggered.on(this.eventTriggered);
		this.node.events.stateChanged.on(this.stateChanged);
		this.node.events.structureChanged.on(this.structureChanged);

		this.pushDisposable(() => {
			this.node.events.attributeChanged.off(this.attributeChanged);
			this.node.events.eventTriggered.off(this.eventTriggered);
			this.node.events.stateChanged.off(this.stateChanged);
			this.node.events.structureChanged.off(this.structureChanged);
		});
	}

	private readonly attributeChanged: ObservableForObserver<
		InstanceType<typeof PairedNode>['events']['attributeChanged']
	> = (attribute) => {
		writeStdout({
			category: MatterServerOutputMessageType.AttributeChanged,
			nodeId: this.node.nodeId,
			attributePath: [
				attribute.path.endpointId,
				attribute.path.clusterId,
				attribute.path.attributeName,
			],
			newValue: Diagnostic.json(attribute.value),
		});
	};

	private readonly eventTriggered: ObservableForObserver<
		InstanceType<typeof PairedNode>['events']['eventTriggered']
	> = (event) => {
		writeStdout({
			category: MatterServerOutputMessageType.EventTriggered,
			nodeId: this.node.nodeId,
			eventPath: [
				event.path.endpointId,
				event.path.clusterId,
				event.path.eventName,
			],
			eventData: Diagnostic.json(event.events),
		});
	};

	private readonly structureChanged: ObservableForObserver<
		InstanceType<typeof PairedNode>['events']['structureChanged']
	> = () => {
		writeStdout({
			category: MatterServerOutputMessageType.StructureChanged,
			nodeId: this.node.nodeId,
		});
		this._listen();
	};

	private readonly stateChanged: ObservableForObserver<
		InstanceType<typeof PairedNode>['events']['stateChanged']
	> = (info) => {
		let stateMessage = '';
		switch (info) {
			case NodeStates.Connected:
				stateMessage = 'connected';
				break;
			case NodeStates.Disconnected:
				stateMessage = 'disconnected';
				break;
			case NodeStates.Reconnecting:
				stateMessage = 'reconnecting';
				break;
			case NodeStates.WaitingForDeviceDiscovery:
				stateMessage = 'waiting for device discovery';
				break;
		}
		writeStdout({
			category: MatterServerOutputMessageType.StateChanged,
			nodeId: this.node.nodeId,
			newState: stateMessage,
		});
	};
}

function writeStdout(message: unknown) {
	process.stderr.write(
		JSON.stringify(message, (_, value) =>
			typeof value === 'bigint' ? value.toString() : value
		) + '\n'
	);
}

type ObservableForObserver<T> =
	T extends Observable<infer U> ? Observer<U> : never;

async function main() {
	const messageQueue: string[] = [];
	let isBooting = true;

	function tryJsonParse(
		message: string
	): (MatterServerInputMessage & { identifier: number }) | null {
		try {
			return JSON.parse(message) as MatterServerInputMessage & {
				identifier: number;
			};
		} catch (error) {
			return null;
		}
	}

	async function handleMessage(messageText: string) {
		const message = tryJsonParse(messageText);
		if (!message) {
			console.error(`Invalid message "${messageText}"`);
			return;
		}
		const response = await controller.onMessage(message);
		writeStdout({
			category: MatterServerOutputMessageType.Response,
			identifier: message.identifier,
			response,
		});
	}

	process.stdin.on('data', async (data) => {
		const messageText = data.toString().trim();
		if (isBooting) {
			messageQueue.push(messageText);
		} else {
			for (const messagePart of messageText.split('\n')) {
				await handleMessage(messagePart);
			}
		}
	});

	const controller = new MatterServer();
	await controller.start();

	isBooting = false;
	while (messageQueue.length > 0) {
		const queuedMessage = messageQueue.shift();
		if (queuedMessage) {
			for (const messagePart of queuedMessage.split('\n')) {
				await handleMessage(messagePart);
			}
		}
	}
}

if (require.main === module) {
	void main();
}
