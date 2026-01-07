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
import type { EWeLinkWebSocketMessage } from './clusters/shared';
import { SettablePromise } from '../../../lib/settable-promise';
import { EventEmitter } from '../../../lib/event-emitter';
import type { EWeLinkConfig } from './clusters/shared';
import type { Cluster } from '../../device/cluster';
import { MappedData } from '../../../lib/data';
import { Data } from '../../../lib/data';
import util from 'util';

export class EwelinkClusterProxy<PARAMS extends object> implements Disposable {
	private _disposables: (() => void)[] = [];
	private _config = new SettablePromise<EWeLinkConfig>();
	private _lastParams: PARAMS | null = null;
	protected readonly _listeners = new Set<(data: PARAMS, isNew: boolean) => void>();
	public onChange: EventEmitter<void> = new EventEmitter();

	public static createGetter<PARAMS extends object>(): () => EwelinkClusterProxy<PARAMS> {
		const proxy = new EwelinkClusterProxy<PARAMS>();
		return () => proxy;
	}

	private _getItemData(device: EWeLinkConfig['device']) {
		const params = device.itemData.params;
		return params as PARAMS;
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
					data.deviceid !== config.device.itemData.deviceid
				) {
					return;
				}

				this._lastParams = {
					...this._lastParams,
					...data.params,
				};
				for (const eventEmitter of this._listeners) {
					eventEmitter(this._lastParams, true);
				}
			})
		);

		this._disposables.push(
			config.periodicFetcher.subscribe((data) => {
				if (!data) {
					return;
				}
				for (const eventEmitter of this._listeners) {
					this._lastParams = data.itemData.params as PARAMS;
					eventEmitter(this._lastParams, false);
				}
			})
		);
	}

	public eventListener<R>(shouldTrigger: (value: PARAMS) => false | R): EventEmitter<R> {
		const eventEmitter = new EventEmitter<R>();

		this._listeners.add((data, isNew) => {
			if (isNew) {
				const result = shouldTrigger(data);
				if (result !== false) {
					eventEmitter.emit(result);
				}
			}
		});
		return eventEmitter;
	}

	public attributeGetter<R>(mapper: (value: PARAMS | undefined) => R | undefined): Data<R> {
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
		const data = new MappedData<R | undefined, PARAMS | undefined>(emitter, mapper);
		data.subscribe((_value, isInitial) => {
			if (!isInitial) {
				return this.onChange.emit(undefined);
			}
		});
		this._listeners.add((data) => emitter.set(data));
		return data as Data<R>;
	}

	public attributeSetter<A>(
		mapper: (args: A, previous: PARAMS | null) => PARAMS
	): (args: A) => Promise<void> {
		return async (args: A) => {
			const mappedInput = mapper(args, this._lastParams);

			const config = await this._config.value;
			if (config.device.itemData.online === false) {
				return;
			}

			this._lastParams = mappedInput;
			await config.connection.setThingStatus({
				id: config.device.itemData.deviceid,
				type: 1,
				params: mappedInput,
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

export abstract class EwelinkOnOffCluster<S extends object>
	extends ConfigurableCluster<S>
	implements DeviceOnOffCluster
{
	public getBaseCluster(): typeof DeviceOnOffCluster {
		return DeviceOnOffCluster;
	}

	public abstract isOn: Data<boolean>;

	public abstract setOn(enabled: boolean): Promise<void>;

	public toggle = async (): Promise<void> => {
		const current = await this.isOn.get();
		if (current === null) {
			throw new Error('Toggle failed: could not get current state');
		}
		return this.setOn(!current);
	};
}

export abstract class EwelinkLevelControlCluster<S extends object>
	extends ConfigurableCluster<S>
	implements DeviceLevelControlCluster
{
	public getBaseCluster(): typeof DeviceLevelControlCluster {
		return DeviceLevelControlCluster;
	}

	public abstract currentLevel: Data<number>;

	// Does not exist, noop
	public startupLevel = this.getProxy().attributeGetter(() => 1.0);

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	public abstract setLevel(args: { level: number; transitionTimeDs?: number }): Promise<void>;

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}

export class EwelinkTemperatureMeasurementCluster
	extends ConfigurableCluster<{
		temperature: string;
	}>
	implements DeviceTemperatureMeasurementCluster
{
	public getBaseCluster(): typeof DeviceTemperatureMeasurementCluster {
		return DeviceTemperatureMeasurementCluster;
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
	public getBaseCluster(): typeof DeviceRelativeHumidityMeasurementCluster {
		return DeviceRelativeHumidityMeasurementCluster;
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
	public getBaseCluster(): typeof DevicePowerSourceCluster {
		return DevicePowerSourceCluster;
	}

	public batteryChargeLevel = this.getProxy().attributeGetter((value) =>
		value?.battery ? Number(value.battery) / 100 : undefined
	);
}

export abstract class EwelinkBooleanStateCluster<S extends object>
	extends ConfigurableCluster<S>
	implements DeviceBooleanStateCluster<boolean>
{
	public getBaseCluster(): typeof DeviceBooleanStateCluster {
		return DeviceBooleanStateCluster;
	}

	public abstract state: Data<boolean>;

	public abstract onStateChange: EventEmitter<{ state: boolean }>;

	public override [Symbol.dispose](): void {
		this.getProxy()[Symbol.dispose]();
	}
}

export class EwelinkOccupancySensingCluster
	extends ConfigurableCluster<{
		motion?: 0 | 1;
	}>
	implements DeviceOccupancySensingCluster
{
	public getBaseCluster(): typeof DeviceOccupancySensingCluster {
		return DeviceOccupancySensingCluster;
	}

	public occupancy = this.getProxy().attributeGetter((value) =>
		value?.motion !== undefined ? value.motion === 1 : false
	);

	public onOccupied = this.getProxy().eventListener((value) => {
		if (value.motion === undefined) {
			return false;
		}
		return {
			occupied: value.motion === 1,
		};
	});
}

export class EwelinkSwitchCluster
	extends ConfigurableCluster<{
		key: 0 | 1;
	}>
	implements DeviceSwitchWithMultiPressCluster
{
	public getBaseCluster(): typeof DeviceSwitchWithMultiPressCluster {
		return DeviceSwitchWithMultiPressCluster;
	}

	public getClusterVariant(): 'multiPress' {
		return 'multiPress';
	}

	public onPress = this.getProxy().eventListener(
		(value) => value.key === 0
	) as unknown as EventEmitter<void>;
	public onMultiPress = this.getProxy().eventListener((value) =>
		value.key === 1 ? { pressCount: 2 } : false
	);

	public getTotalCount = (): number => 1;
	public getIndex = (): number => 1;
	public getLabel = (): string => 'Button';
}

export class EwelinkOutletSwitchCluster
	extends ConfigurableCluster<{
		key: 0 | 1;
		outlet: number;
	}>
	implements DeviceSwitchWithMultiPressCluster
{
	public getBaseCluster(): typeof DeviceSwitchWithMultiPressCluster {
		return DeviceSwitchWithMultiPressCluster;
	}

	public getClusterVariant(): 'multiPress' {
		return 'multiPress';
	}

	public constructor(
		protected override readonly _eWeLinkConfig: EWeLinkConfig,
		private readonly _outletCount: number,
		private readonly _outlet: { index: number; label: string }
	) {
		super(_eWeLinkConfig);
	}

	public getTotalCount = (): number => this._outletCount;
	public getIndex = (): number => this._outlet.index;
	public getLabel = (): string => this._outlet.label;

	public onPress = this.getProxy().eventListener((value) => {
		return value.key === 0 && value.outlet === this._outlet.index;
	}) as unknown as EventEmitter<void>;
	public onMultiPress = this.getProxy().eventListener((value) =>
		value.key === 1 && value.outlet === this._outlet.index ? { pressCount: 2 } : false
	);
}
