import {
	OnOffDevice,
	WindowCoveringDevice,
	LevelControlDevice,
	PowerSourceDevice,
	GroupsDevice,
	DeviceStatus,
} from '../../device/device';
import {
	GroupId,
	Status,
	type Attribute,
	type BitSchema,
	type ClusterId,
	type Command,
} from '@matter/types';
import type {
	Groups,
	OnOffCluster,
	PowerSource,
	WindowCovering,
} from '@matter/main/clusters';
import type { Cluster, Device, DeviceGroupId } from '../../device/device';
import type { DeviceCluster, DeviceEndpoint } from '../server/server';
import { MappedAsyncEventEmitter } from '../../../lib/event-emitter';
import { MatterServerInputMessageType } from '../server/server';
import { LevelControl } from '@matter/main/clusters';
import type { MatterClient } from './client';

export class MatterEndpoint {
	public endpoints: MatterEndpoint[] = [];
	public clusters: MatterCluster[] = [];

	public constructor(
		protected readonly nodeId: string,
		public readonly endpointNumber: string,
		protected readonly clusterMeta: DeviceCluster[],
		protected readonly matterClient: MatterClient,
		endpointMeta: DeviceEndpoint[]
	) {
		this.endpoints = endpointMeta.map(
			(endpoint) =>
				new MatterEndpoint(
					this.nodeId,
					endpoint.number,
					endpoint.clusterMeta,
					this.matterClient,
					endpoint.endpoints
				)
		);
		this.clusters = this._getClusters();
	}

	protected _getClusters(): MatterCluster[] {
		const clusters: MatterCluster[] = [];
		for (const clusterMeta of this.clusterMeta) {
			const ClusterWithName =
				clusterMeta.name in CLUSTERS
					? CLUSTERS[clusterMeta.name as keyof typeof CLUSTERS]
					: null;
			if (!ClusterWithName) {
				if (!IGNORED_CLUSTERS.includes(clusterMeta.name)) {
					console.error(
						`${this.nodeId}/${this.endpointNumber}: Cluster ${clusterMeta.name} not found`
					);
				}
				continue;
			}
			clusters.push(
				new ClusterWithName(
					new ClusterProxy(
						this.nodeId,
						this.endpointNumber,
						clusterMeta.id,
						clusterMeta.name,
						this.matterClient
					)
				)
			);
		}
		return clusters;
	}

	public onAttributeChanged(
		attributePath: string[],
		newValue: unknown
	): void {
		for (const device of this.clusters) {
			device.proxy.onAttributeChanged(attributePath, newValue);
		}
	}
}

export class MatterDevice extends MatterEndpoint implements Device {
	public recursiveClusters: MatterCluster[];
	public recursiveEndpoints: MatterEndpoint[];

	public constructor(
		public nodeId: string,
		public rootEndpointNumber: string,
		public name: string,
		matterClient: MatterClient,
		clusterMeta: DeviceCluster[],
		endpointMeta: DeviceEndpoint[]
	) {
		super(
			nodeId,
			rootEndpointNumber,
			clusterMeta,
			matterClient,
			endpointMeta
		);

		this.recursiveClusters = [];
		this.recursiveEndpoints = [];
		const walkRecursives = (device: MatterEndpoint): void => {
			for (const cluster of device.clusters) {
				this.recursiveClusters.push(cluster);
			}
			for (const endpoint of device.endpoints) {
				this.recursiveEndpoints.push(endpoint);
				walkRecursives(endpoint);
			}
		};
		walkRecursives(this);
	}

	public getUniqueId(): string {
		return `matter:${this.nodeId}:${this.rootEndpointNumber}`;
	}
}

interface MatterCluster extends Cluster {
	proxy: ClusterProxy<ClusterInterface>;
}

type AttributeType<A extends Attribute<unknown, BitSchema>> =
	A extends Attribute<infer T, BitSchema> ? T : never;
type CommandTypes<C extends Command<unknown, unknown, BitSchema>> =
	C extends Command<infer T, infer R, BitSchema>
		? {
				args: T;
				response: R;
			}
		: never;

interface ClusterInterface {
	attributes: Record<string, Attribute<unknown, BitSchema>>;
	commands: Record<string, Command<unknown, unknown, BitSchema>>;
}

class ClusterProxy<C extends ClusterInterface> {
	#attributes: Record<string, MappedAsyncEventEmitter<unknown>> = {};
	readonly #matterClient: MatterClient;

	public constructor(
		public readonly nodeId: string,
		public readonly endpointNumber: string,
		public readonly id: ClusterId,
		public readonly name: string,
		matterClient: MatterClient
	) {
		this.#matterClient = matterClient;
	}

	public onAttributeChanged(
		attributePath: string[],
		newValue: unknown
	): void {
		const attributePathString = attributePath.join('.');

		const attribute = this.#attributes[attributePathString];
		attribute.emit(newValue);
	}

	public attribute<
		A extends Extract<keyof C['attributes'], string>,
		AT extends AttributeType<C['attributes'][A]>,
		R = AT,
	>(attribute: A, mapper?: (value: AT) => R): MappedAsyncEventEmitter<AT, R> {
		const eventEmitter = new MappedAsyncEventEmitter<AT, R>(mapper, () =>
			this.#matterClient.request({
				type: MatterServerInputMessageType.GetAttribute,
				arguments: [
					this.nodeId,
					this.endpointNumber,
					this.id,
					attribute,
				],
			})
		);
		this.#attributes[attribute] = eventEmitter;

		return eventEmitter;
	}

	public command<M extends Extract<keyof C['commands'], string>, R>(
		command: M,
		mappers: {
			input: () => CommandTypes<C['commands'][M]>['args'];
			output: (value: CommandTypes<C['commands'][M]>['response']) => R;
		}
	): () => Promise<R>;
	public command<M extends Extract<keyof C['commands'], string>, A, R>(
		command: M,
		mappers: {
			input: (value: A) => CommandTypes<C['commands'][M]>['args'];
			output: (value: CommandTypes<C['commands'][M]>['response']) => R;
		}
	): (args: A) => Promise<R>;
	public command<M extends Extract<keyof C['commands'], string>, A = void>(
		command: M,
		mappers: {
			input: (value: A) => CommandTypes<C['commands'][M]>['args'];
		}
	): (args: A) => Promise<CommandTypes<C['commands'][M]>['response']>;
	public command<M extends Extract<keyof C['commands'], string>, R = void>(
		command: M,
		mappers: {
			output: (value: CommandTypes<C['commands'][M]>['response']) => R;
		}
	): (args: CommandTypes<C['commands'][M]>['args']) => Promise<R>;
	public command<M extends Extract<keyof C['commands'], string>>(
		command: M
	): (
		args: CommandTypes<C['commands'][M]>['args']
	) => Promise<CommandTypes<C['commands'][M]>['response']>;
	public command<
		M extends Extract<keyof C['commands'], string>,
		A = void,
		R = void,
	>(
		command: M,
		mappers?: {
			input?: (value: A) => CommandTypes<C['commands'][M]>['args'];
			output?: (value: CommandTypes<C['commands'][M]>['response']) => R;
		}
	): (args: A) => Promise<CommandTypes<C['commands'][M]>['response']> {
		return async (args: A) => {
			const mappedInput = mappers?.input
				? mappers.input(args)
				: (args as unknown);
			const payload: unknown[] =
				mappedInput === undefined
					? []
					: Array.isArray(mappedInput)
						? (mappedInput as unknown[])
						: [mappedInput];
			const result = this.#matterClient.request({
				type: MatterServerInputMessageType.CallCluster,
				arguments: [
					this.nodeId,
					this.endpointNumber,
					this.id,
					command,
					payload,
				],
			});
			const response = await result;
			const mappedOutput = mappers?.output
				? mappers.output(response)
				: response;
			return mappedOutput as CommandTypes<C['commands'][M]>['response'];
		};
	}
}

export class MatterOnOffCluster extends OnOffDevice implements MatterCluster {
	public constructor(public readonly proxy: ClusterProxy<OnOffCluster>) {
		super();
	}

	public isOn = this.proxy.attribute('onOff');

	public setOn(on: boolean): Promise<void> {
		if (on) {
			return this.proxy.command('on')();
		} else {
			return this.proxy.command('off')();
		}
	}

	public toggle = this.proxy.command('toggle');
}

export class MatterWindowCoveringCluster
	extends WindowCoveringDevice
	implements MatterCluster
{
	public constructor(
		public readonly proxy: ClusterProxy<WindowCovering.Complete>
	) {
		super();
	}

	public currentPositionLiftPercentage = this.proxy.attribute(
		'currentPositionLiftPercentage',
		(num) => num ?? 0
	);
	public targetPositionLiftPercentage = this.proxy.attribute(
		'targetPositionLiftPercent100ths',
		(num) => (num ? num / 100 : 0)
	);
	public operationalStatus = this.proxy.attribute('operationalStatus');

	public close = this.proxy.command('downOrClose');

	public open = this.proxy.command('upOrOpen');

	public goToLiftPercentage = this.proxy.command<
		'goToLiftPercentage',
		{
			percentage: number;
		}
	>('goToLiftPercentage', {
		input: ({ percentage }) => ({
			liftPercent100thsValue: percentage / 100,
		}),
	});
}

export class MatterLevelControlCluster
	extends LevelControlDevice
	implements MatterCluster
{
	public constructor(
		public readonly proxy: ClusterProxy<LevelControl.Complete>
	) {
		super();
	}

	public currentLevel = this.proxy.attribute(
		'currentLevel',
		(v: number | null | undefined) => v ?? 0
	);

	public moveToLevel = this.proxy.command<
		'moveToLevel',
		{ level: number; transitionTimeDs?: number }
	>('moveToLevel', {
		input: ({ level, transitionTimeDs }) => ({
			level,
			transitionTime: transitionTimeDs ?? null,
			optionsMask: {},
			optionsOverride: {},
		}),
	});

	public move = this.proxy.command<
		'move',
		{ direction: 'Up' | 'Down'; rate?: number }
	>('move', {
		input: ({ direction, rate }) => ({
			moveMode:
				direction === 'Up'
					? LevelControl.MoveMode.Up
					: LevelControl.MoveMode.Down,
			rate: rate ?? null,
			optionsMask: {},
			optionsOverride: {},
		}),
	});

	public step = this.proxy.command<
		'step',
		{
			direction: 'Up' | 'Down';
			stepSize: number;
			transitionTimeDs?: number;
		}
	>('step', {
		input: ({ direction, stepSize, transitionTimeDs }) => ({
			stepMode:
				direction === 'Up'
					? LevelControl.StepMode.Up
					: LevelControl.StepMode.Down,
			stepSize,
			transitionTime: transitionTimeDs ?? null,
			optionsMask: {},
			optionsOverride: {},
		}),
	});

	public stop = this.proxy.command<'stop', void>('stop', {
		input: () => ({
			optionsMask: {},
			optionsOverride: {},
		}),
	});
}

export class MatterPowerSourceCluster
	extends PowerSourceDevice
	implements MatterCluster
{
	public constructor(
		public readonly proxy: ClusterProxy<PowerSource.Complete>
	) {
		super();
	}

	public batteryChargeLevel = this.proxy.attribute('batChargeLevel');
}

export class MatterGroupsCluster extends GroupsDevice implements MatterCluster {
	public constructor(public readonly proxy: ClusterProxy<Groups.Cluster>) {
		super();
	}

	public addGroup = this.proxy.command('addGroup', {
		output: ({ status, groupId }) => ({
			status: fromMatterStatus(status),
			groupId: fromMatterGroupId(groupId),
		}),
	});
	public listGroupMemberships = this.proxy.command('getGroupMembership', {
		input: () => ({
			groupList: [],
		}),
		output: ({ groupList }) => ({
			groupList: groupList.map(fromMatterGroupId),
		}),
	});

	/**
	 * Given a list of group IDs, returns only those groups this device is a member of.
	 */
	public getFilteredGroupMembership = this.proxy.command(
		'getGroupMembership',
		{
			input: ({ groupList }: { groupList: number[] }) => ({
				groupList: groupList.map(toMatterGroupId),
			}),
			output: ({ groupList }) => ({
				groupList: groupList.map(fromMatterGroupId),
			}),
		}
	);

	public removeGroup = this.proxy.command('removeGroup', {
		input: ({ groupId }: { groupId: DeviceGroupId }) => ({
			groupId: toMatterGroupId(groupId),
		}),
		output: ({ status, groupId }) => ({
			status: fromMatterStatus(status),
			groupId: fromMatterGroupId(groupId),
		}),
	});
}

function fromMatterStatus(status: Status): DeviceStatus {
	switch (status) {
		case Status.Success:
			return DeviceStatus.Success;
		case Status.Failure:
			return DeviceStatus.Failure;
	}
	throw new Error(`Unimplemented status: ${status}`);
}

function fromMatterGroupId(groupId: GroupId): DeviceGroupId {
	return groupId as unknown as DeviceGroupId;
}

function toMatterGroupId(groupId: DeviceGroupId): GroupId {
	return GroupId(groupId);
}

const CLUSTERS = {
	[MatterOnOffCluster.clusterName]: MatterOnOffCluster,
	[MatterWindowCoveringCluster.clusterName]: MatterWindowCoveringCluster,
	[MatterLevelControlCluster.clusterName]: MatterLevelControlCluster,
	[MatterPowerSourceCluster.clusterName]: MatterPowerSourceCluster,
	[MatterGroupsCluster.clusterName]: MatterGroupsCluster,
	// Switch: MatterSwitchCluster,
	// BooleanState: MatterBooleanStateCluster,
	// IlluminanceMeasurement: MatterIlluminanceMeasurementCluster,
	// TemperatureMeasurement: MatterTemperatureMeasurementCluster,
	// PressureMeasurement: MatterPressureMeasurementCluster,
	// RelativeHumidityMeasurement: MatterRelativeHumidityMeasurementCluster,
	// OccupancySensing: MatterOccupancySensingCluster,
	// ColorControl: MatterColorControlCluster,
};

const IGNORED_CLUSTERS = [
	'Descriptor',
	'Identify',
	'BridgedDeviceBasicInformation',
];
