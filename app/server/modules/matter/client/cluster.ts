import {
	DeviceOnOffCluster,
	DeviceWindowCoveringCluster,
	DeviceLevelControlCluster,
	DevicePowerSourceCluster,
	DeviceGroupsCluster,
	DeviceOccupancySensingCluster,
	DeviceIlluminanceMeasurementCluster,
	DeviceTemperatureMeasurementCluster,
	DeviceColorControlCluster,
} from '../../device/cluster';
import type {
	ColorControl,
	Groups,
	IlluminanceMeasurement,
	OccupancySensing,
	OnOffCluster,
	PowerSource,
	TemperatureMeasurement,
	WindowCovering,
} from '@matter/main/clusters';
import {
	AsyncEventEmitter,
	CombinedAsyncEventEmitter,
	MappedAsyncEventEmitter,
} from '../../../lib/event-emitter';
import {
	GroupId,
	Status,
	type Attribute,
	type BitSchema,
	type ClusterId,
	type Command,
} from '@matter/types';
import type {
	Cluster,
	DeviceClusterName,
	DeviceGroupId,
} from '../../device/cluster';
import { SettablePromise } from '../../../lib/settable-promise';
import { MatterServerInputMessageType } from '../server/server';
import type { LevelControl } from '@matter/main/clusters';
import type { WritableAttribute } from '@matter/types';
import { DeviceStatus } from '../../device/cluster';
import type { MatterClient } from './client';
import { Color } from '../../../lib/color';

export interface MatterCluster<IF extends MatterClusterInterface>
	extends Cluster,
		Disposable {
	getProxy(): ClusterProxy<IF>;
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

class ClusterProxy<C extends MatterClusterInterface> implements Disposable {
	#attributes: Record<string, AsyncEventEmitter<unknown, unknown>> = {};
	private _dependencies = new SettablePromise<{
		readonly nodeId: string;
		readonly endpointNumber: string;
		readonly id: ClusterId;
		readonly name: string;
		matterClient: MatterClient;
	}>();

	private constructor() {}

	public setDependencies(dependencies: {
		readonly nodeId: string;
		readonly endpointNumber: string;
		readonly id: ClusterId;
		readonly name: string;
		matterClient: MatterClient;
	}) {
		this._dependencies.set(dependencies);
	}

	public static createGetter<
		C extends MatterClusterInterface,
	>(): () => ClusterProxy<C> {
		const proxy = new ClusterProxy();
		return () => proxy;
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
	): AsyncEventEmitter<AT, R> {
		const emitter = (() => {
			const emitter = new AsyncEventEmitter<AT>(async () => {
				const { matterClient, nodeId, endpointNumber, id } =
					await this._dependencies.value;
				return matterClient.request({
					type: MatterServerInputMessageType.GetAttribute,
					arguments: [nodeId, endpointNumber, id, attribute],
				});
			});
			if (mapper) {
				return new MappedAsyncEventEmitter<AT, R>(emitter, mapper);
			}
			return emitter;
		})();
		this.#attributes[attribute] = emitter;

		return emitter as AsyncEventEmitter<AT, R>;
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
			const { matterClient, nodeId, endpointNumber, id } =
				await this._dependencies.value;
			await matterClient.request({
				type: MatterServerInputMessageType.SetAttribute,
				arguments: [nodeId, endpointNumber, id, attribute, mapped],
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
			const { matterClient, nodeId, endpointNumber, id } =
				await this._dependencies.value;
			const result = matterClient.request({
				type: MatterServerInputMessageType.CallCluster,
				arguments: [nodeId, endpointNumber, id, command, payload],
			});
			const response = await result;
			const mappedOutput = mappers?.output
				? mappers.output(response)
				: response;
			return mappedOutput as CommandTypes<C['commands'][M]>['response'];
		};
	}

	public eventEmitter<
		A extends Extract<WritableAttributes<C['attributes']>, string>,
		AT extends AttributeType<C['attributes'][A]>,
		I,
	>(
		attribute: A,
		mapper: (value: I) => AT | Promise<AT>
	): (value: I) => Promise<void> {
		return async (value: I) => {
			const mapped = await mapper(value);
			const { matterClient, nodeId, endpointNumber, id } =
				await this._dependencies.value;
			await matterClient.request({
				type: MatterServerInputMessageType.SetAttribute,
				arguments: [nodeId, endpointNumber, id, attribute, mapped],
			});
		};
	}

	public [Symbol.dispose](): void {
		for (const attribute of Object.values(this.#attributes)) {
			attribute[Symbol.dispose]();
		}
	}
}

function ConfigurableCluster<T extends MatterClusterInterface>(
	Base: (abstract new () => Cluster & {
		getName: () => DeviceClusterName;
	}) & { clusterName: DeviceClusterName }
) {
	return class extends Base {
		public getProxy = ClusterProxy.createGetter<T>();

		public constructor(
			nodeId: string,
			endpointNumber: string,
			id: ClusterId,
			name: string,
			matterClient: MatterClient
		) {
			super();
			this.getProxy().setDependencies({
				nodeId,
				endpointNumber,
				id,
				name,
				matterClient,
			});
		}

		public [Symbol.dispose](): void {
			this.getProxy()[Symbol.dispose]();
		}
	};
}

class MatterOnOffCluster extends ConfigurableCluster<OnOffCluster>(
	DeviceOnOffCluster
) {
	public isOn = this.getProxy().attributeGetter('onOff');

	public setOn(on: boolean): Promise<void> {
		if (on) {
			return this.getProxy().command('on')();
		} else {
			return this.getProxy().command('off')();
		}
	}

	public toggle = this.getProxy().command('toggle');
}

class MatterWindowCoveringCluster extends ConfigurableCluster<WindowCovering.Complete>(
	DeviceWindowCoveringCluster
) {
	public currentPositionLiftPercentage = this.getProxy().attributeGetter(
		'currentPositionLiftPercentage',
		(num) => num ?? 0
	);
	public targetPositionLiftPercentage = this.getProxy().attributeGetter(
		'targetPositionLiftPercent100ths',
		(num) => (num ? num / 100 : 0)
	);
	public operationalStatus =
		this.getProxy().attributeGetter('operationalStatus');

	public close = this.getProxy().command('downOrClose');

	public open = this.getProxy().command('upOrOpen');

	public goToLiftPercentage = this.getProxy().command<
		'goToLiftPercentage',
		{
			percentage: number;
		}
	>('goToLiftPercentage', {
		input: ({ percentage }: { percentage: number }) => ({
			liftPercent100thsValue: percentage / 100,
		}),
	});
}

class MatterLevelControlCluster extends ConfigurableCluster<LevelControl.Complete>(
	DeviceLevelControlCluster
) {
	private _minLevel = this.getProxy().attributeGetter(
		'currentLevel',
		(v: number | null | undefined) => v ?? 0
	);
	private _maxLevel = this.getProxy().attributeGetter(
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
	public currentLevel = this.getProxy().attributeGetter(
		'currentLevel',
		this._valueToFloat.bind(this)
	);

	/**
	 * Float from 0 to 1
	 */
	public startupLevel = this.getProxy().attributeGetter(
		'startUpCurrentLevel',
		this._valueToFloat.bind(this)
	);

	/**
	 * Float from 0 to 1
	 */
	public setStartupLevel = this.getProxy().attributeSetter(
		'startUpCurrentLevel',
		({ level }) => this._floatToValue(level)
	);

	public setLevel = this.getProxy().command<
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

	public stop = this.getProxy().command<'stop', void>('stop', {
		input: () => ({
			optionsMask: {},
			optionsOverride: {},
		}),
	});
}

class MatterPowerSourceCluster extends ConfigurableCluster<PowerSource.Complete>(
	DevicePowerSourceCluster
) {
	public batteryChargeLevel = this.getProxy().attributeGetter(
		'batPercentRemaining',
		(value) => (value ? value / 200 : null)
	);
}

class MatterOccupancySensingCluster extends ConfigurableCluster<OccupancySensing.Complete>(
	DeviceOccupancySensingCluster
) {
	public occupancy = this.getProxy().attributeGetter(
		'occupancy',
		(state) => state?.occupied ?? false
	);
}

class MatterIlluminanceMeasurementCluster extends ConfigurableCluster<IlluminanceMeasurement.Cluster>(
	DeviceIlluminanceMeasurementCluster
) {
	/**
	 * MeasuredValue = 10,000 x log10(lux) + 1,
	 */
	public illuminance = this.getProxy().attributeGetter(
		'measuredValue',
		(value) => value ?? 0
	);
}

class MatterTemperatureMeasurementCluster extends ConfigurableCluster<TemperatureMeasurement.Cluster>(
	DeviceTemperatureMeasurementCluster
) {
	public temperature = this.getProxy().attributeGetter(
		'measuredValue',
		(value) => (value ?? 0) / 100
	);
}

class MatterGroupsCluster extends ConfigurableCluster<Groups.Cluster>(
	DeviceGroupsCluster
) {
	public addGroup = this.getProxy().command('addGroup', {
		output: ({ status, groupId }) => ({
			status: fromMatterStatus(status),
			groupId: fromMatterGroupId(groupId),
		}),
	});
	public listGroupMemberships = this.getProxy().command(
		'getGroupMembership',
		{
			input: () => ({
				groupList: [],
			}),
			output: ({ groupList }) => ({
				groupList: groupList.map(fromMatterGroupId),
			}),
		}
	);

	/**
	 * Given a list of group IDs, returns only those groups this device is a member of.
	 */
	public getFilteredGroupMembership = this.getProxy().command(
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

	public removeGroup = this.getProxy().command('removeGroup', {
		input: ({ groupId }: { groupId: DeviceGroupId }) => ({
			groupId: toMatterGroupId(groupId),
		}),
		output: ({ status, groupId }) => ({
			status: fromMatterStatus(status),
			groupId: fromMatterGroupId(groupId),
		}),
	});
}

class MatterColorControlCluster extends ConfigurableCluster<ColorControl.Complete>(
	DeviceColorControlCluster
) {
	private static readonly MAX_COLOR_VALUE = 65279;

	private _currentX = this.getProxy().attributeGetter(
		'currentX',
		(value) => value / MatterColorControlCluster.MAX_COLOR_VALUE
	);
	private _currentY = this.getProxy().attributeGetter(
		'currentY',
		(value) => value / MatterColorControlCluster.MAX_COLOR_VALUE
	);
	public color = new MappedAsyncEventEmitter(
		new CombinedAsyncEventEmitter([this._currentX, this._currentY]),
		([x, y]) => Color.fromCieXy(x, y)
	);

	public setColor = this.getProxy().command('moveToColor', {
		input: ({
			color,
			overDurationMs,
		}: {
			color: Color;
			overDurationMs?: number;
		}) => {
			const { x, y } = color.toCieXy();
			return {
				colorX: Math.round(
					x * MatterColorControlCluster.MAX_COLOR_VALUE
				),
				colorY: Math.round(
					y * MatterColorControlCluster.MAX_COLOR_VALUE
				),
				transitionTime: overDurationMs ?? 0,
				optionsMask: {},
				optionsOverride: {},
			};
		},
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
	[MatterOnOffCluster.clusterName.value]: MatterOnOffCluster,
	[MatterWindowCoveringCluster.clusterName.value]:
		MatterWindowCoveringCluster,
	[MatterLevelControlCluster.clusterName.value]: MatterLevelControlCluster,
	[MatterPowerSourceCluster.clusterName.value]: MatterPowerSourceCluster,
	[MatterGroupsCluster.clusterName.value]: MatterGroupsCluster,
	[MatterOccupancySensingCluster.clusterName.value]:
		MatterOccupancySensingCluster,
	[MatterIlluminanceMeasurementCluster.clusterName.value]:
		MatterIlluminanceMeasurementCluster,
	[MatterTemperatureMeasurementCluster.clusterName.value]:
		MatterTemperatureMeasurementCluster,
	[MatterColorControlCluster.clusterName.value]: MatterColorControlCluster,
};

export const IGNORED_MATTER_CLUSTERS = [
	'Descriptor',
	'Identify',
	'BridgedDeviceBasicInformation',
	'BasicInformation',
	'GeneralCommissioning',
	'NetworkCommissioning',
	'GeneralDiagnostics',
	'EthernetNetworkDiagnostics',
	'AdministratorCommissioning',
	'OperationalCredentials',
	'GroupKeyManagement',
	'PowerSourceConfiguration',
	'AccessControl',
	// Given that this requires complex timing logic might as well
	// just keep this under the original framework.
	'Switch',
];
