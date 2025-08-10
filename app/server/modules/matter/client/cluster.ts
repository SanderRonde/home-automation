import type {
	Cluster,
	DeviceGroupId,
	DeviceOnOffCluster,
	DeviceWindowCoveringCluster,
	DeviceLevelControlCluster,
	DevicePowerSourceCluster,
	DeviceGroupsCluster,
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
import { MappedAsyncEventEmitter } from '../../../lib/event-emitter';
import { MatterServerInputMessageType } from '../server/server';
import type { LevelControl } from '@matter/main/clusters';
import type { WritableAttribute } from '@matter/types';
import { DeviceStatus } from '../../device/device';
import type { MatterClient } from './client';

export abstract class MatterCluster<IF extends MatterClusterInterface>
	implements Cluster
{
	public readonly proxy: ClusterProxy<IF>;

	public constructor(
		nodeId: string,
		endpointNumber: string,
		id: ClusterId,
		name: string,
		matterClient: MatterClient
	) {
		this.proxy = new ClusterProxy(
			nodeId,
			endpointNumber,
			id,
			name,
			matterClient
		);
	}
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

type WritableAttributes<
	ATTR extends Record<string, Attribute<unknown, BitSchema>>,
> = {
	[K in keyof ATTR]: ATTR[K] extends WritableAttribute<unknown, BitSchema>
		? K
		: never;
}[keyof ATTR];

export interface MatterClusterInterface {
	attributes: Record<string, Attribute<unknown, BitSchema>>;
	commands: Record<string, Command<unknown, unknown, BitSchema>>;
}

class ClusterProxy<C extends MatterClusterInterface> {
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
		void attribute.emit(newValue);
	}

	public attributeGetter<
		A extends Extract<keyof C['attributes'], string>,
		AT extends AttributeType<C['attributes'][A]>,
		R = AT,
	>(
		attribute: A,
		mapper?: (value: AT) => R | Promise<R>
	): MappedAsyncEventEmitter<AT, R> {
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

	public attributeSetter<
		A extends Extract<WritableAttributes<C['attributes']>, string>,
		AT extends AttributeType<C['attributes'][A]>,
		I,
	>(
		attribute: A,
		mapper: (value: I) => AT | Promise<AT>
	): (value: I) => Promise<void> {
		return async (value: I) => {
			const mapped = await mapper(value);
			await this.#matterClient.request({
				type: MatterServerInputMessageType.SetAttribute,
				arguments: [
					this.nodeId,
					this.endpointNumber,
					this.id,
					attribute,
					mapped,
				],
			});
		};
	}

	public command<M extends Extract<keyof C['commands'], string>, R>(
		command: M,
		mappers: {
			input: () =>
				| CommandTypes<C['commands'][M]>['args']
				| Promise<CommandTypes<C['commands'][M]>['args']>;
			output: (value: CommandTypes<C['commands'][M]>['response']) => R;
		}
	): () => Promise<R>;
	public command<M extends Extract<keyof C['commands'], string>, A, R>(
		command: M,
		mappers: {
			input: (
				value: A
			) =>
				| CommandTypes<C['commands'][M]>['args']
				| Promise<CommandTypes<C['commands'][M]>['args']>;
			output: (value: CommandTypes<C['commands'][M]>['response']) => R;
		}
	): (args: A) => Promise<R>;
	public command<M extends Extract<keyof C['commands'], string>, A = void>(
		command: M,
		mappers: {
			input: (
				value: A
			) =>
				| CommandTypes<C['commands'][M]>['args']
				| Promise<CommandTypes<C['commands'][M]>['args']>;
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
			input?: (
				value: A
			) =>
				| CommandTypes<C['commands'][M]>['args']
				| Promise<CommandTypes<C['commands'][M]>['args']>;
			output?: (value: CommandTypes<C['commands'][M]>['response']) => R;
		}
	): (args: A) => Promise<CommandTypes<C['commands'][M]>['response']> {
		return async (args: A) => {
			const mappedInput = mappers?.input
				? await mappers.input(args)
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

export class MatterOnOffCluster
	extends MatterCluster<OnOffCluster>
	implements DeviceOnOffCluster
{
	public static get clusterName(): string {
		return 'OnOff';
	}

	public isOn = this.proxy.attributeGetter('onOff');

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
	extends MatterCluster<WindowCovering.Complete>
	implements DeviceWindowCoveringCluster
{
	public static get clusterName(): string {
		return 'WindowCovering';
	}

	public currentPositionLiftPercentage = this.proxy.attributeGetter(
		'currentPositionLiftPercentage',
		(num) => num ?? 0
	);
	public targetPositionLiftPercentage = this.proxy.attributeGetter(
		'targetPositionLiftPercent100ths',
		(num) => (num ? num / 100 : 0)
	);
	public operationalStatus = this.proxy.attributeGetter('operationalStatus');

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
	extends MatterCluster<LevelControl.Complete>
	implements DeviceLevelControlCluster
{
	public static get clusterName(): string {
		return 'LevelControl';
	}

	private _minLevel = this.proxy.attributeGetter(
		'currentLevel',
		(v: number | null | undefined) => v ?? 0
	);
	private _maxLevel = this.proxy.attributeGetter(
		'maxLevel',
		(v: number | null | undefined) => v ?? 0
	);
	private async _valueToFloat(v: number | null | undefined) {
		const value = v ?? 0;
		const [minLevel, maxLevel] = await Promise.all([
			this._minLevel.value,
			this._maxLevel.value,
		]);
		return (value - minLevel) / (maxLevel - minLevel);
	}
	private async _floatToValue(f: number) {
		const [minLevel, maxLevel] = await Promise.all([
			this._minLevel.value,
			this._maxLevel.value,
		]);
		return minLevel + (maxLevel - minLevel) * f;
	}

	/**
	 * Float from 0 to 1
	 */
	public currentLevel = this.proxy.attributeGetter(
		'currentLevel',
		this._valueToFloat.bind(this)
	);

	/**
	 * Float from 0 to 1
	 */
	public startupLevel = this.proxy.attributeGetter(
		'startUpCurrentLevel',
		this._valueToFloat.bind(this)
	);

	/**
	 * Float from 0 to 1
	 */
	public setStartupLevel = this.proxy.attributeSetter(
		'startUpCurrentLevel',
		({ level }) => this._floatToValue(level)
	);

	public setLevel = this.proxy.command<
		'moveToLevel',
		{ level: number; transitionTimeDs?: number }
	>('moveToLevel', {
		input: async ({ level, transitionTimeDs }) => ({
			level: await this._floatToValue(level),
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
	extends MatterCluster<PowerSource.Complete>
	implements DevicePowerSourceCluster
{
	public static get clusterName(): string {
		return 'PowerSource';
	}

	public batteryChargeLevel = this.proxy.attributeGetter('batChargeLevel');
}

export class MatterGroupsCluster
	extends MatterCluster<Groups.Cluster>
	implements DeviceGroupsCluster
{
	public static get clusterName(): string {
		return 'Groups';
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

export const MATTER_CLUSTERS = {
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

export const IGNORED_MATTER_CLUSTERS = [
	'Descriptor',
	'Identify',
	'BridgedDeviceBasicInformation',
];
