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
	GroupId,
	Status,
	type Attribute,
	type BitSchema,
	type ClusterId,
	type Command,
} from '@matter/types';
import {
	MatterServer,
	MatterServerInputMessageType,
	MatterServerOutputMessageType,
} from '../server/server';
import type {
	Cluster,
	DeviceClusterName,
	DeviceGroupId,
} from '../../device/cluster';
import { PairedNode } from '@project-chip/matter.js/device';
import type { LevelControl } from '@matter/main/clusters';
import type { EndpointNumber, WritableAttribute } from '@matter/types';
import { DeviceStatus } from '../../device/cluster';
import { CombinedData } from '../../../lib/data';
import { MappedData } from '../../../lib/data';
import type { MatterClient } from './client';
import { Color } from '../../../lib/color';
import { Data } from '../../../lib/data';

export interface MatterCluster<IF extends MatterClusterInterface>
	extends Cluster,
		Disposable {
	_proxy: ClusterProxy<IF>;
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
	#attributes: Record<string, Data<unknown>> = {};

	public constructor(
		private readonly node: PairedNode,
		private readonly endpointNumber: EndpointNumber,
		private readonly id: ClusterId,
		private readonly matterServer: MatterServer
	) {
		matterServer.addListener((message) => {
			if (
				message.category ===
				MatterServerOutputMessageType.AttributeChanged
			) {
				if (
					message.nodeId === nodeId &&
					message.attributePath[0] === Number(endpointNumber) &&
					message.attributePath[1] === id
				) {
					this.onAttributeChanged(
						message.attributePath[2],
						JSON.parse(message.newValue)
					);
				}
			}
		});
	}

	public onAttributeChanged(attributeName: string, newValue: unknown): void {
		const attribute = this.#attributes[attributeName];
		if (attribute) {
			void attribute.set(newValue);
		}
	}

	public attributeGetter<
		A extends Extract<keyof C['attributes'], string>,
		AT extends AttributeType<C['attributes'][A]>,
		R = AT,
	>(
		attribute: A,
		mapper?: (value: AT | undefined) => R
	): Data<R | undefined> {
		const emitter = (() => {
			const {
				matterServer: matterClient,
				nodeId,
				endpointNumber,
				id,
			} = this;
			class cls extends Data<AT | undefined> {
				public override async get(): Promise<Exclude<AT, undefined>> {
					return (await matterClient.request({
						type: MatterServerInputMessageType.GetAttribute,
						arguments: [nodeId, endpointNumber, id, attribute],
					})) as Exclude<AT, undefined>;
				}
			}

			const emitter = new cls(undefined);
			if (mapper) {
				return new MappedData<R, AT | undefined>(emitter, mapper);
			}
			return emitter;
		})();
		this.#attributes[attribute] = emitter;

		return emitter as Data<R | undefined>;
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
			await this.matterServer.setAttribute(this.node.nodeId, this.endpointNumber, this.id, attribute, mapped)
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
			const result = this.matterServer.callCluster(
				this.node.nodeId,
				this.endpointNumber,
				this.id,
				command,
				payload
			);
			const response = await result;
			const mappedOutput = mappers?.output
				? mappers.output(response)
				: response;
			return mappedOutput as CommandTypes<C['commands'][M]>['response'];
		};
	}
}

function ConfigurableCluster<T extends MatterClusterInterface>(
	Base: (abstract new () => Cluster & {
		getName: () => DeviceClusterName;
	}) & { clusterName: DeviceClusterName }
) {
	return class extends Base {
		public _proxy: ClusterProxy<T>;

		public constructor(
			node: PairedNode,
			endpoint: Endpoint,
			id: ClusterId,
			matterServer: MatterServer
		) {
			super();
			this._proxy = new ClusterProxy(
				node,
				endpoint,
				id,
				matterServer
			);
		}

		public [Symbol.dispose](): void {
			// ...
		}
	};
}

class MatterOnOffCluster extends ConfigurableCluster<OnOffCluster>(
	DeviceOnOffCluster
) {
	public isOn = this._proxy.attributeGetter('onOff');

	public setOn(on: boolean): Promise<void> {
		if (on) {
			return this._proxy.command('on')();
		} else {
			return this._proxy.command('off')();
		}
	}

	public toggle = this._proxy.command('toggle');
}

class MatterWindowCoveringCluster extends ConfigurableCluster<WindowCovering.Complete>(
	DeviceWindowCoveringCluster
) {
	public currentPositionLiftPercentage = this._proxy.attributeGetter(
		'currentPositionLiftPercentage',
		(num) => num ?? 0
	);
	public targetPositionLiftPercentage = this._proxy.attributeGetter(
		'targetPositionLiftPercent100ths',
		(num) => (num ? num / 100 : 0)
	);
	public operationalStatus = this._proxy.attributeGetter('operationalStatus');

	public close = this._proxy.command('downOrClose');

	public open = this._proxy.command('upOrOpen');

	public goToLiftPercentage = this._proxy.command<
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
	private _minLevel = this._proxy.attributeGetter(
		'currentLevel',
		(v: number | null | undefined) => v ?? 0
	);
	private _maxLevel = this._proxy.attributeGetter(
		'maxLevel',
		(v: number | null | undefined) => v ?? 0
	);
	private async _valueToFloat(v: number | null | undefined) {
		const value = v ?? 0;
		const [minLevel, maxLevel] = await Promise.all([
			this._minLevel.get(),
			this._maxLevel.get(),
		]);
		return (value - minLevel) / (maxLevel - minLevel);
	}
	private async _floatToValue(f: number) {
		const [minLevel, maxLevel] = await Promise.all([
			this._minLevel.get(),
			this._maxLevel.get(),
		]);
		return minLevel + (maxLevel - minLevel) * f;
	}

	/**
	 * Float from 0 to 1
	 */
	public currentLevel = this._proxy.attributeGetter(
		'currentLevel',
		this._valueToFloat.bind(this)
	);

	/**
	 * Float from 0 to 1
	 */
	public startupLevel = this._proxy.attributeGetter(
		'startUpCurrentLevel',
		this._valueToFloat.bind(this)
	);

	/**
	 * Float from 0 to 1
	 */
	public setStartupLevel = this._proxy.attributeSetter(
		'startUpCurrentLevel',
		({ level }) => this._floatToValue(level)
	);

	public setLevel = this._proxy.command<
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

	public stop = this._proxy.command<'stop', void>('stop', {
		input: () => ({
			optionsMask: {},
			optionsOverride: {},
		}),
	});
}

class MatterPowerSourceCluster extends ConfigurableCluster<PowerSource.Complete>(
	DevicePowerSourceCluster
) {
	public batteryChargeLevel = this._proxy.attributeGetter(
		'batPercentRemaining',
		(value) => (value ? value / 200 : null)
	);
}

class MatterOccupancySensingCluster extends ConfigurableCluster<OccupancySensing.Complete>(
	DeviceOccupancySensingCluster
) {
	public occupancy = this._proxy.attributeGetter(
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
	public illuminance = this._proxy.attributeGetter(
		'measuredValue',
		(value) => value ?? 0
	);
}

class MatterTemperatureMeasurementCluster extends ConfigurableCluster<TemperatureMeasurement.Cluster>(
	DeviceTemperatureMeasurementCluster
) {
	public temperature = this._proxy.attributeGetter(
		'measuredValue',
		(value) => (value ?? 0) / 100
	);
}

class MatterGroupsCluster extends ConfigurableCluster<Groups.Cluster>(
	DeviceGroupsCluster
) {
	public addGroup = this._proxy.command('addGroup', {
		output: ({ status, groupId }) => ({
			status: fromMatterStatus(status),
			groupId: fromMatterGroupId(groupId),
		}),
	});
	public listGroupMemberships = this._proxy.command('getGroupMembership', {
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
	public getFilteredGroupMembership = this._proxy.command(
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

	public removeGroup = this._proxy.command('removeGroup', {
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

	private _currentX = this._proxy.attributeGetter('currentX', (value) =>
		value ? value / MatterColorControlCluster.MAX_COLOR_VALUE : undefined
	);
	private _currentY = this._proxy.attributeGetter('currentY', (value) =>
		value ? value / MatterColorControlCluster.MAX_COLOR_VALUE : undefined
	);
	public color = new MappedData(
		new CombinedData([this._currentX, this._currentY]),
		([x, y]) =>
			x === undefined || y === undefined
				? undefined
				: Color.fromCieXy(x, y)
	);

	public setColor = this._proxy.command('moveToColor', {
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
