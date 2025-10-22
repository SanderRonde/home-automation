/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	DeviceLevelControlCluster,
	DeviceTemperatureMeasurementCluster,
	DeviceRelativeHumidityMeasurementCluster,
	DevicePowerSourceCluster,
	DeviceBooleanStateCluster,
	DeviceOccupancySensingCluster,
	DeviceOnOffCluster,
	DeviceSwitchWithMultiPressCluster,
} from '../../device/cluster';
import type { Cluster, DeviceClusterName } from '../../device/cluster';
import type { EWeLinkWebSocketMessage } from './clusters/shared';
import { SettablePromise } from '../../../lib/settable-promise';
import { EventEmitter } from '../../../lib/event-emitter';
import type { EWeLinkConfig } from './clusters/shared';
import { MappedData } from '../../../lib/data';
import { Data } from '../../../lib/data';
import util from 'util';

export class EwelinkClusterProxy<PARAMS extends object> implements Disposable {
	private _disposables: (() => void)[] = [];
	private _config = new SettablePromise<EWeLinkConfig>();
	private readonly _fromParams: (state: object) => PARAMS = (s) => s as PARAMS;
	private readonly _toParams: (state: PARAMS) => object = (s) => s;
	private _lastParams: PARAMS | null = null;
	protected readonly _eventEmitters = new Set<Data<unknown>>();
	private _online: SettablePromise<boolean> = new SettablePromise();
	public onChange: EventEmitter<void> = new EventEmitter();

	private constructor(mappers?: {
		fromParams: (state: object) => PARAMS;
		toParams: (state: PARAMS) => object;
	}) {
		if (mappers) {
			this._fromParams = mappers.fromParams;
			this._toParams = mappers.toParams;
		}
	}

	public static createGetter<PARAMS extends object>(mappers?: {
		fromParams: (state: object) => PARAMS;
		toParams: (state: PARAMS) => object;
	}): () => EwelinkClusterProxy<PARAMS> {
		const proxy = new EwelinkClusterProxy<PARAMS>(
			mappers
				? {
						fromParams: mappers.fromParams,
						toParams: mappers.toParams,
					}
				: undefined
		);
		return () => proxy;
	}

	private _getItemData(device: EWeLinkConfig['device']) {
		const params = device.itemData.params;
		return this._fromParams(params) as PARAMS & {
			deviceid: string;
		};
	}

	public setConfig(config: EWeLinkConfig): void {
		this._config.set(config);

		this._lastParams = this._getItemData(config.device);
		this._disposables.push(
			config.wsConnection.listen((data: EWeLinkWebSocketMessage<PARAMS>) => {
				if (
					typeof data === 'string' ||
					!('action' in data) ||
					data.action !== 'update' ||
					data.deviceid !== this._getItemData(config.device).deviceid
				) {
					return;
				}

				this._lastParams = {
					...this._lastParams,
					...data.params,
				};
				for (const eventEmitter of this._eventEmitters) {
					void eventEmitter.set(this._lastParams);
				}
			})
		);

		if (config.device.itemData.online) {
			this._online.set(true);
		}

		this._disposables.push(
			config.periodicFetcher.subscribe((data) => {
				if (!data) {
					return;
				}
				if (data.itemData.online) {
					this._online.set(true);
				} else {
					this._online = new SettablePromise();
				}
				for (const eventEmitter of this._eventEmitters) {
					this._lastParams = this._fromParams(data.itemData.params);
					void eventEmitter.set(this._lastParams);
				}
			})
		);
	}

	public eventListener<R>(shouldTrigger: (value: PARAMS) => false | R): EventEmitter<R> {
		const eventEmitter = new EventEmitter<R>();

		const wsListener = new Data<PARAMS | undefined>(undefined);
		wsListener.subscribe((value) => {
			if (value !== undefined) {
				const result = shouldTrigger(value);
				if (result !== false) {
					eventEmitter.emit(result);
				}
			}
		});
		this._eventEmitters.add(wsListener);
		return eventEmitter;
	}

	public attributeGetter<R>(mapper: (value: PARAMS | undefined) => R | undefined): Data<R> {
		const emitter = (() => {
			class cls extends Data<PARAMS | undefined> {
				private _initialized = false;

				public constructor(
					private readonly getInitialValue: () => Promise<PARAMS | undefined>
				) {
					super(undefined);
				}

				protected override create(): void {
					if (!this._initialized) {
						this._initialized = true;
						void this.getInitialValue().then((value) => this.set(value));
					}
				}
			}

			const emitter = new cls(() =>
				this._config.value.then((config) => this._getItemData(config.device))
			);
			if (mapper) {
				return new MappedData<R | undefined, PARAMS | undefined>(emitter, mapper);
			}
			return emitter;
		})();
		emitter.subscribe(() => this.onChange.emit(undefined));
		this._eventEmitters.add(emitter);
		return emitter as Data<R>;
	}

	public attributeSetter<M extends keyof PARAMS, A = void>(
		attribute: M,
		mapper: (args: A) => PARAMS[M]
	): (args: A) => Promise<void>;
	public attributeSetter<M extends keyof PARAMS>(
		attribute: M
	): (args: PARAMS[M]) => Promise<void>;
	public attributeSetter<M extends Extract<keyof PARAMS, string>, A = void>(
		attribute: M,
		mapper?: (args: A) => PARAMS[M]
	): (args: A) => Promise<void> {
		return async (args: A) => {
			const mappedInput = mapper ? mapper(args) : args;

			await this._online.value;

			const config = await this._config.value;
			const newParams = {
				...this._lastParams,
				[attribute]: mappedInput,
			} as PARAMS;
			this._lastParams = newParams;
			await config.connection.setThingStatus({
				id: config.device.itemData.deviceid,
				type: 1,
				params: this._toParams(newParams),
			});
		};
	}

	public [Symbol.dispose](): void {
		for (const disposable of this._disposables) {
			disposable();
		}
	}

	public [util.inspect.custom](): string {
		return `${this.constructor.name} { }`;
	}
}

export interface EwelinkCluster extends Cluster {}

export interface EwelinkOnOffClusterState {
	enabled: boolean;
}

class ConfigurableCluster<T extends object> {
	protected getProxy = EwelinkClusterProxy.createGetter<T>();
	public onChange: EventEmitter<void>;

	public constructor(protected readonly _eWeLinkConfig: EWeLinkConfig) {
		this.getProxy().setConfig(this._eWeLinkConfig);
		this.onChange = this.getProxy().onChange;
	}

	public [Symbol.dispose](): void {
		this.getProxy()[Symbol.dispose]();
	}
}

export abstract class EwelinkOnOffCluster
	extends ConfigurableCluster<EwelinkOnOffClusterState>
	implements DeviceOnOffCluster
{
	public getName(): DeviceClusterName {
		return DeviceOnOffCluster.clusterName;
	}

	public isOn = this.getProxy().attributeGetter((value) => value?.enabled ?? false);

	public setOn = this.getProxy().attributeSetter('enabled', (enabled: boolean) => enabled);

	public toggle = async (): Promise<void> => {
		const current = await this.isOn.get();
		if (current === null) {
			throw new Error('Toggle failed: could not get current state');
		}
		return this.setOn(!current);
	};
}

export interface EwelinkLevelControlClusterState {
	level: number;
}

export abstract class EwelinkLevelControlCluster
	extends ConfigurableCluster<EwelinkLevelControlClusterState>
	implements DeviceLevelControlCluster
{
	public getName(): DeviceClusterName {
		return DeviceLevelControlCluster.clusterName;
	}

	public currentLevel = this.getProxy().attributeGetter((value) => value?.level ?? 0);

	// Does not exist, noop
	public startupLevel = this.getProxy().attributeGetter(() => 1.0);

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	public setLevel = this.getProxy().attributeSetter(
		'level',
		(args: { level: number; transitionTimeDs?: number }) => args.level
	);

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}

export class EwelinkTemperatureMeasurementCluster
	extends ConfigurableCluster<{
		temperature: string;
	}>
	implements DeviceTemperatureMeasurementCluster
{
	public getName(): DeviceClusterName {
		return DeviceTemperatureMeasurementCluster.clusterName;
	}

	public temperature = this.getProxy().attributeGetter((value) =>
		value?.temperature ? Number(value.temperature) / 100 : undefined
	);
}

export class EwelinkRelativeHumidityMeasurementCluster
	extends ConfigurableCluster<{
		humidity: string;
	}>
	implements DeviceRelativeHumidityMeasurementCluster
{
	public getName(): DeviceClusterName {
		return DeviceRelativeHumidityMeasurementCluster.clusterName;
	}

	public relativeHumidity = this.getProxy().attributeGetter((value) =>
		value?.humidity ? Number(value.humidity) / 10000 : undefined
	);
}

export class EwelinkPowerSourceCluster
	extends ConfigurableCluster<{
		battery: number;
	}>
	implements DevicePowerSourceCluster
{
	public getName(): DeviceClusterName {
		return DevicePowerSourceCluster.clusterName;
	}

	public batteryChargeLevel = this.getProxy().attributeGetter((value) =>
		value?.battery ? Number(value.battery) / 100 : undefined
	);
}

export abstract class EwelinkBooleanStateCluster
	extends ConfigurableCluster<{
		state: boolean;
	}>
	implements DeviceBooleanStateCluster<boolean>
{
	public getName(): DeviceClusterName {
		return DeviceBooleanStateCluster.clusterName;
	}

	public state = this.getProxy().attributeGetter((value) => value?.state ?? false);

	public override [Symbol.dispose](): void {
		this.getProxy()[Symbol.dispose]();
	}
}

export class EwelinkOccupancySensingCluster
	extends ConfigurableCluster<{
		motion: 0 | 1;
	}>
	implements DeviceOccupancySensingCluster
{
	public getName(): DeviceClusterName {
		return DeviceOccupancySensingCluster.clusterName;
	}

	public occupancy = this.getProxy().attributeGetter((value) =>
		value ? value.motion === 1 : false
	);

	public onOccupied = this.getProxy().eventListener((value) => ({
		occupied: value.motion === 1,
	}));
}

export class EwelinkSwitchCluster
	extends ConfigurableCluster<{
		key: 0 | 1;
	}>
	implements DeviceSwitchWithMultiPressCluster
{
	public getName(): DeviceClusterName {
		return DeviceSwitchWithMultiPressCluster.clusterName;
	}

	public onPress = this.getProxy().eventListener(
		(value) => value.key === 0
	) as unknown as EventEmitter<void>;
	public onMultiPress = this.getProxy().eventListener((value) =>
		value.key === 1 ? { pressCount: 2 } : false
	);

	public getTotalCount = (): number => 1;
	public getIndex = (): number => 1;
}

export class EwelinkOutletSwitchCluster
	extends ConfigurableCluster<{
		key: 0 | 1;
		outlet: number;
	}>
	implements DeviceSwitchWithMultiPressCluster
{
	public getName(): DeviceClusterName {
		return DeviceSwitchWithMultiPressCluster.clusterName;
	}

	public constructor(
		protected override readonly _eWeLinkConfig: EWeLinkConfig,
		private readonly _outletCount: number,
		private readonly _outlet: number
	) {
		super(_eWeLinkConfig);
	}

	public getTotalCount = (): number => this._outletCount;
	public getIndex = (): number => this._outlet;

	public onPress = this.getProxy().eventListener(
		(value) => value.key === 0 && value.outlet === this._outlet
	) as unknown as EventEmitter<void>;
	public onMultiPress = this.getProxy().eventListener((value) =>
		value.key === 1 && value.outlet === this._outlet ? { pressCount: 2 } : false
	);
}
