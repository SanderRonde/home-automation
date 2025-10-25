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
	DeviceActionsCluster,
} from '../../device/cluster';
import type {
	Cluster,
	DeviceGroupId,
	DeviceSwitchCluster,
	DeviceSwitchWithLongPressAndMultiPressCluster,
	DeviceSwitchWithLongPressCluster,
	DeviceSwitchWithMultiPressCluster,
} from '../../device/cluster';
import type {
	ColorControl,
	Actions,
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
	type Command,
	type Event,
} from '@matter/types';
import type { PairedNode, Endpoint } from '@project-chip/matter.js/device';
import type { Switch } from '@matter/types/clusters/switch';
import { EventEmitter } from '../../../lib/event-emitter';
import type { LevelControl } from '@matter/main/clusters';
import { DeviceClusterName } from '../../device/cluster';
import type { ClusterClientObj } from '@matter/protocol';
import type { Observable, Observer } from '@matter/main';
import type { WritableAttribute } from '@matter/types';
import { DeviceStatus } from '../../device/cluster';
import { CombinedData } from '../../../lib/data';
import { MappedData } from '../../../lib/data';
import { Color } from '../../../lib/color';
import { Data } from '../../../lib/data';

export interface MatterCluster<IF extends MatterClusterInterface> extends Cluster, Disposable {
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
type EventTypes<E extends Event<unknown, BitSchema>> =
	E extends Event<infer T, BitSchema> ? T : never;

type WritableAttributes<ATTR extends Record<string, Attribute<unknown, BitSchema>>> = {
	[K in keyof ATTR]: ATTR[K] extends WritableAttribute<unknown, BitSchema> ? K : never;
}[keyof ATTR];

export interface MatterClusterInterface {
	attributes: Record<string, Attribute<unknown, BitSchema>>;
	commands: Record<string, Command<unknown, unknown, BitSchema>>;
	events: Record<string, Event<unknown, BitSchema>>;
}

class ClusterProxy<C extends MatterClusterInterface> implements Disposable {
	#attributes: Record<string, Data<unknown>> = {};
	private _disposables: Set<() => void> = new Set();
	public onChange: EventEmitter<void> = new EventEmitter();

	public constructor(
		node: PairedNode,
		public readonly endpoint: Endpoint,
		public readonly cluster: ClusterClientObj
	) {
		node.events.attributeChanged.on(this.onAttributeChanged);
		this._disposables.add(() => {
			node.events.attributeChanged.off(this.onAttributeChanged);
		});
	}

	public onAttributeChanged: ObservableForObserver<
		InstanceType<typeof PairedNode>['events']['attributeChanged']
	> = (attribute) => {
		if (
			attribute.path.endpointId === this.endpoint.number &&
			attribute.path.clusterId === this.cluster.id
		) {
			this.onChange.emit(undefined);
			this.#attributes[attribute.path.attributeName]?.set(attribute.value);
		}
	};

	public attributeGetter<
		A extends Extract<keyof C['attributes'], string>,
		AT extends AttributeType<C['attributes'][A]>,
		R = AT | undefined,
	>(attributeName: A, mapper?: (value: AT | undefined) => R): Data<R> {
		const emitter = (() => {
			const { cluster } = this;
			class cls extends Data<AT | undefined> {
				public override async get(): Promise<AT> {
					const attribute = cluster.attributes[attributeName];

					const tryGet = async () => {
						const result = await attribute.get();
						if (mapper) {
							return mapper(result);
						}
						return result;
					};

					for (let i = 0; i < 3; i++) {
						try {
							return await tryGet();
						} catch (error) {
							console.error(`Error getting attribute ${attributeName}`);
						}
					}

					if (mapper) {
						return mapper(undefined) as unknown as AT;
					}
					return undefined as unknown as AT;
				}

				public override set(value: AT | undefined): void {
					if (mapper) {
						super.set(mapper(value) as Exclude<AT, undefined>);
					} else {
						super.set(value);
					}
				}
			}

			return new cls(undefined);
		})();
		this.#attributes[attributeName] = emitter;

		return emitter as unknown as Data<R>;
	}

	public attributeSetter<
		A extends Extract<WritableAttributes<C['attributes']>, string>,
		AT extends AttributeType<C['attributes'][A]>,
		I,
	>(attributeName: A, mapper: (value: I) => AT | Promise<AT>): (value: I) => Promise<void> {
		return async (value: I) => {
			const mapped = await mapper(value);
			const attribute = this.cluster.attributes[attributeName];
			await attribute.set(mapped);
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
	public command<M extends Extract<keyof C['commands'], string>, A = void, R = void>(
		commandName: M,
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
			let mappedInput = ((mappers?.input ? await mappers.input(args) : args) ??
				[]) as unknown[];
			if (!Array.isArray(mappedInput)) {
				mappedInput = [mappedInput];
			}
			const command = this.cluster.commands[commandName];
			if (!command) {
				throw new Error(`Command ${commandName} not found in cluster ${this.cluster.name}`);
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const response = await (command as any)(...mappedInput);
			const mappedOutput = mappers?.output ? mappers.output(response) : response;
			return mappedOutput as CommandTypes<C['commands'][M]>['response'];
		};
	}

	public event<E extends Extract<keyof C['events'], string>, R = EventTypes<C['events'][E]>>(
		eventName: E,
		mappers?: {
			output: (value: EventTypes<C['events'][E]>) => R;
		}
	): EventEmitter<R> {
		const event = this.cluster.events[eventName];
		if (!event) {
			throw new Error(`Event ${eventName} not found in cluster ${this.cluster.name}`);
		}

		const emitter = new EventEmitter<R>();
		event.addListener((newValue) => {
			const mappedOutput = mappers?.output
				? mappers.output(newValue as EventTypes<C['events'][E]>)
				: newValue;
			emitter.emit(mappedOutput as R);
		});
		return emitter;
	}

	public [Symbol.dispose](): void {
		this._disposables.forEach((dispose) => dispose());
		this._disposables.clear();
	}
}

type ObservableForObserver<T> = T extends Observable<infer U> ? Observer<U> : never;

class ConfigurableCluster<T extends MatterClusterInterface> {
	public _proxy: ClusterProxy<T>;
	public onChange: EventEmitter<void>;

	public constructor(node: PairedNode, endpoint: Endpoint, cluster: ClusterClientObj) {
		this._proxy = new ClusterProxy<T>(node, endpoint, cluster);
		this.onChange = this._proxy.onChange;
	}

	public [Symbol.dispose](): void {
		this._proxy[Symbol.dispose]();
	}
}

class MatterOnOffCluster extends ConfigurableCluster<OnOffCluster> implements DeviceOnOffCluster {
	public getName(): DeviceClusterName {
		return DeviceOnOffCluster.clusterName;
	}

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

class MatterWindowCoveringCluster
	extends ConfigurableCluster<WindowCovering.Complete>
	implements DeviceWindowCoveringCluster
{
	public getName(): DeviceClusterName {
		return DeviceWindowCoveringCluster.clusterName;
	}

	public targetPositionLiftPercentage = this._proxy.attributeGetter(
		'targetPositionLiftPercent100ths',
		(num) => (num ? num / 100 : undefined)
	);
	public operationalStatus = this._proxy.attributeGetter('operationalStatus');

	public close = this._proxy.command('downOrClose');

	public open = this._proxy.command('upOrOpen');

	public _goToLiftPercentage = this._proxy.command<
		'goToLiftPercentage',
		{
			percentage: number;
		}
	>('goToLiftPercentage', {
		input: ({ percentage }: { percentage: number }) => ({
			liftPercent100thsValue: percentage * 100,
		}),
	});
	public goToLiftPercentage = ({ percentage }: { percentage: number }) => {
		if (this.targetPositionLiftPercentage.current() === percentage) {
			// If already at the target position, do nothing.
			// This fixes a bug where ikea blinds will try to move to the
			// position even if they're already there.
			return Promise.resolve();
		}
		return this._goToLiftPercentage({ percentage });
	};
}

class MatterLevelControlCluster
	extends ConfigurableCluster<LevelControl.Complete>
	implements DeviceLevelControlCluster
{
	public getName(): DeviceClusterName {
		return DeviceLevelControlCluster.clusterName;
	}

	private _minLevel = this._proxy.attributeGetter(
		'minLevel',
		(v: number | null | undefined) => v ?? 0
	);
	private _maxLevel = this._proxy.attributeGetter(
		'maxLevel',
		(v: number | null | undefined) => v ?? 0
	);
	private _valueToFloat(v: number | null | undefined) {
		const value = v ?? 0;
		const [minLevel, maxLevel] = [this._minLevel.current(), this._maxLevel.current()];
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
	public setStartupLevel = this._proxy.attributeSetter('startUpCurrentLevel', ({ level }) =>
		this._floatToValue(level)
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

class MatterPowerSourceCluster
	extends ConfigurableCluster<PowerSource.Complete>
	implements DevicePowerSourceCluster
{
	public getName(): DeviceClusterName {
		return DevicePowerSourceCluster.clusterName;
	}

	public batteryChargeLevel = this._proxy.attributeGetter('batPercentRemaining', (value) =>
		value ? value / 200 : undefined
	);
}

class MatterOccupancySensingCluster
	extends ConfigurableCluster<OccupancySensing.Complete>
	implements DeviceOccupancySensingCluster
{
	public getName(): DeviceClusterName {
		return DeviceOccupancySensingCluster.clusterName;
	}

	public occupancy = this._proxy.attributeGetter(
		'occupancy',
		(state) => state?.occupied ?? false
	);

	public onOccupied = this._proxy.event('occupancyChanged', {
		output: ({ occupancy }) => {
			return { occupied: occupancy.occupied ?? false };
		},
	});
}

class MatterIlluminanceMeasurementCluster
	extends ConfigurableCluster<IlluminanceMeasurement.Cluster>
	implements DeviceIlluminanceMeasurementCluster
{
	public getName(): DeviceClusterName {
		return DeviceIlluminanceMeasurementCluster.clusterName;
	}

	/**
	 * MeasuredValue = 10,000 x log10(lux) + 1,
	 */
	public illuminance = this._proxy.attributeGetter('measuredValue', (value) => value ?? 0);
}

class MatterTemperatureMeasurementCluster
	extends ConfigurableCluster<TemperatureMeasurement.Cluster>
	implements DeviceTemperatureMeasurementCluster
{
	public getName(): DeviceClusterName {
		return DeviceTemperatureMeasurementCluster.clusterName;
	}

	public temperature = this._proxy.attributeGetter(
		'measuredValue',
		(value) => (value ?? 0) / 100
	);
}

class MatterGroupsCluster
	extends ConfigurableCluster<Groups.Cluster>
	implements DeviceGroupsCluster
{
	public getName(): DeviceClusterName {
		return DeviceGroupsCluster.clusterName;
	}

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
	public getFilteredGroupMembership = this._proxy.command('getGroupMembership', {
		input: ({ groupList }: { groupList: number[] }) => ({
			groupList: groupList.map(toMatterGroupId),
		}),
		output: ({ groupList }) => ({
			groupList: groupList.map(fromMatterGroupId),
		}),
	});

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

class MatterColorControlCluster
	extends ConfigurableCluster<ColorControl.Complete>
	implements DeviceColorControlCluster
{
	public getName(): DeviceClusterName {
		return DeviceColorControlCluster.clusterName;
	}

	private static readonly MAX_COLOR_VALUE = 65279;

	private _currentX = this._proxy.attributeGetter('currentX', (value) =>
		value ? value / MatterColorControlCluster.MAX_COLOR_VALUE : undefined
	);
	private _currentY = this._proxy.attributeGetter('currentY', (value) =>
		value ? value / MatterColorControlCluster.MAX_COLOR_VALUE : undefined
	);
	public color = new MappedData(new CombinedData([this._currentX, this._currentY]), ([x, y]) => {
		return x === undefined || y === undefined ? undefined : Color.fromCieXy(x, y);
	});

	public setColor = this._proxy.command('moveToColor', {
		input: ({ color, overDurationMs }: { color: Color; overDurationMs?: number }) => {
			const { x, y } = color.toCieXy();
			return {
				colorX: Math.round(x * MatterColorControlCluster.MAX_COLOR_VALUE),
				colorY: Math.round(y * MatterColorControlCluster.MAX_COLOR_VALUE),
				transitionTime: overDurationMs ?? 0,
				optionsMask: {},
				optionsOverride: {},
			};
		},
	});

	public getSegmentCount = () => 1;
}

class MatterActionsCluster
	extends ConfigurableCluster<Actions.Cluster>
	implements DeviceActionsCluster
{
	public getName(): DeviceClusterName {
		return DeviceActionsCluster.clusterName;
	}

	public actionList = this._proxy.attributeGetter(
		'actionList',
		(actions) =>
			actions?.map((action) => ({
				id: action.actionId,
				name: action.name,
				type: action.type,
				state: action.state,
			})) ?? []
	);

	public executeAction = this._proxy.command('startAction');
}

abstract class MatterSwitchClusterBase extends ConfigurableCluster<Switch.Complete> {
	public getName(): DeviceClusterName {
		return DeviceClusterName.SWITCH;
	}

	public getTotalCount = () => this._counts.totalCount;
	public getIndex = () => this._counts.count;
	public getLabel = () => `Button ${this._counts.count}`;

	public constructor(
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj,
		private readonly _counts: {
			totalCount: number;
			count: number;
		}
	) {
		super(node, endpoint, cluster);
	}
}

const voidMapper = { output: () => void 0 };
class MatterSwitchCluster extends MatterSwitchClusterBase implements DeviceSwitchCluster {
	public onPress = this._proxy.event('initialPress', voidMapper);
}

class MatterSwitchWithLongPressCluster
	extends MatterSwitchClusterBase
	implements DeviceSwitchWithLongPressCluster
{
	public onPress = this._proxy.event('initialPress', voidMapper);
	public onLongPress = this._proxy.event('longPress', voidMapper);
}

class MatterSwitchWithMultiPressCluster
	extends MatterSwitchClusterBase
	implements DeviceSwitchWithMultiPressCluster
{
	public onPress = this._proxy.event('initialPress', voidMapper);
	public onMultiPress = this._proxy.event('multiPressComplete', {
		output: ({ totalNumberOfPressesCounted }) => {
			return { pressCount: totalNumberOfPressesCounted ?? 0 };
		},
	});
}

class MatterSwitchWithLongPressAndMultiPressCluster
	extends MatterSwitchClusterBase
	implements DeviceSwitchWithLongPressAndMultiPressCluster
{
	public onPress = this._proxy.event('initialPress', voidMapper);
	public onLongPress = this._proxy.event('longPress', voidMapper);
	public onMultiPress = this._proxy.event('multiPressComplete', {
		output: ({ totalNumberOfPressesCounted }) => {
			return { pressCount: totalNumberOfPressesCounted ?? 0 };
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
	[DeviceClusterName.ON_OFF]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterOnOffCluster => new MatterOnOffCluster(node, endpoint, cluster),
	[DeviceClusterName.WINDOW_COVERING]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterWindowCoveringCluster => new MatterWindowCoveringCluster(node, endpoint, cluster),
	[DeviceClusterName.LEVEL_CONTROL]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterLevelControlCluster => new MatterLevelControlCluster(node, endpoint, cluster),
	[DeviceClusterName.POWER_SOURCE]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterPowerSourceCluster => new MatterPowerSourceCluster(node, endpoint, cluster),
	[DeviceClusterName.GROUPS]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterGroupsCluster => new MatterGroupsCluster(node, endpoint, cluster),
	[DeviceClusterName.COLOR_CONTROL]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterColorControlCluster => new MatterColorControlCluster(node, endpoint, cluster),
	[DeviceClusterName.ACTIONS]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterActionsCluster => new MatterActionsCluster(node, endpoint, cluster),
	[DeviceClusterName.OCCUPANCY_SENSING]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterOccupancySensingCluster => new MatterOccupancySensingCluster(node, endpoint, cluster),
	[DeviceClusterName.ILLUMINANCE_MEASUREMENT]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterIlluminanceMeasurementCluster =>
		new MatterIlluminanceMeasurementCluster(node, endpoint, cluster),
	[DeviceClusterName.TEMPERATURE_MEASUREMENT]: (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj
	): MatterTemperatureMeasurementCluster =>
		new MatterTemperatureMeasurementCluster(node, endpoint, cluster),
	[DeviceClusterName.SWITCH]: async (
		node: PairedNode,
		endpoint: Endpoint,
		cluster: ClusterClientObj,
		clusterClients: ClusterClientObj[]
	): Promise<MatterSwitchCluster | null> => {
		const featureMap = await (
			cluster as unknown as ClusterClientObj<Switch.Complete>
		).attributes.featureMap.get();
		if (!featureMap) {
			console.error(`Switch cluster on endpoint ${endpoint.number} has no feature map`);
			return null;
		}
		if (!featureMap.momentarySwitch) {
			console.error(
				`Switch cluster on endpoint ${endpoint.number} is not a momentary switch`
			);
			return null;
		}

		const allSwitchClusters = clusterClients.filter(
			(clusterClient) => clusterClient.name === DeviceClusterName.SWITCH.toString()
		);
		const sortedSwitchClusters = allSwitchClusters.sort((a, b) => a.endpointId - b.endpointId);
		const indexInClusters = sortedSwitchClusters.indexOf(cluster);

		const counts = {
			totalCount: sortedSwitchClusters.length,
			count: indexInClusters + 1,
		};

		if (featureMap.momentarySwitchMultiPress && featureMap.momentarySwitchLongPress) {
			return new MatterSwitchWithLongPressAndMultiPressCluster(
				node,
				endpoint,
				cluster,
				counts
			);
		} else if (featureMap.momentarySwitchMultiPress) {
			return new MatterSwitchWithMultiPressCluster(node, endpoint, cluster, counts);
		} else if (featureMap.momentarySwitchLongPress) {
			return new MatterSwitchWithLongPressCluster(node, endpoint, cluster, counts);
		} else {
			return new MatterSwitchCluster(node, endpoint, cluster, counts);
		}
	},
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
	'DiagnosticLogs',
	'PowerSourceConfiguration',
	'AccessControl',
];
