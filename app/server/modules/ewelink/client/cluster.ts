/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	DeviceLevelControlCluster,
	DeviceTemperatureMeasurementCluster,
	DeviceRelativeHumidityMeasurementCluster,
	DevicePowerSourceCluster,
	DeviceBooleanStateCluster,
	DeviceOccupancySensingCluster,
	DeviceSwitchCluster,
	DeviceOnOffCluster,
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
	private readonly _fromParams: (state: object) => PARAMS = (s) =>
		s as PARAMS;
	private readonly _toParams: (state: PARAMS) => object = (s) => s;
	private _lastParams: PARAMS | null = null;
	protected readonly _eventEmitters = new Set<Data<unknown>>();
	private _online: SettablePromise<boolean> = new SettablePromise();

	public constructor(
		private readonly _config: EWeLinkConfig,
		mappers?: {
			fromParams: (state: object) => PARAMS;
			toParams: (state: PARAMS) => object;
		}
	) {
		if (mappers) {
			this._fromParams = mappers.fromParams;
			this._toParams = mappers.toParams;
		}

		this._lastParams = this._getItemData(_config.device);
		this._disposables.push(
			_config.wsConnection.listen(
				(data: EWeLinkWebSocketMessage<PARAMS>) => {
					if (
						typeof data === 'string' ||
						!('action' in data) ||
						data.action !== 'update' ||
						data.deviceid !==
							this._getItemData(_config.device).deviceid
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
				}
			)
		);

		if (_config.device.itemData.online) {
			this._online.set(true);
		}

		this._disposables.push(
			_config.periodicFetcher.subscribe((data) => {
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

	private _getItemData(device: EWeLinkConfig['device']) {
		const params = device.itemData.params;
		return this._fromParams(params) as PARAMS & {
			deviceid: string;
		};
	}

	public eventListener(
		shouldTrigger: (value: PARAMS) => boolean
	): EventEmitter<void> {
		const eventEmitter = new EventEmitter<void>();

		const wsListener = new Data<PARAMS | undefined>(undefined);
		wsListener.subscribe((value) => {
			if (value !== undefined && shouldTrigger(value)) {
				eventEmitter.emit(undefined);
			}
		});
		this._eventEmitters.add(wsListener);
		return eventEmitter;
	}

	public attributeGetter<R>(
		mapper?: (value: PARAMS) => R
	): Data<R | undefined> {
		const emitter = (() => {
			class cls extends Data<PARAMS | undefined> {
				private _initialized = false;

				public constructor(
					private readonly getInitialValue: () => PARAMS | undefined
				) {
					super(undefined);
				}

				protected override create(): void {
					if (!this._initialized) {
						this._initialized = true;
						this.set(this.getInitialValue());
					}
				}
			}

			const emitter = new cls(() =>
				this._getItemData(this._config.device)
			);
			if (mapper) {
				return new MappedData<R | null, PARAMS | undefined>(
					emitter,
					mapper
				);
			}
			return emitter;
		})();
		this._eventEmitters.add(emitter);
		return emitter as Data<R | undefined>;
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

			const newParams = {
				...this._lastParams,
				[attribute]: mappedInput,
			} as PARAMS;
			this._lastParams = newParams;
			await this._config.connection.setThingStatus({
				id: this._config.device.itemData.deviceid,
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

function ConfigurableCluster<T extends object>(
	Base: abstract new () => Cluster & {
		getName: () => DeviceClusterName;
	}
) {
	return class extends Base {
		protected _proxy: EwelinkClusterProxy<T>;

		public constructor(protected readonly _eWeLinkConfig: EWeLinkConfig) {
			super();
			this._proxy = new EwelinkClusterProxy(this._eWeLinkConfig);
		}

		public [Symbol.dispose](): void {
			this._proxy[Symbol.dispose]();
		}
	};
}

export abstract class EwelinkOnOffCluster extends ConfigurableCluster<EwelinkOnOffClusterState>(
	DeviceOnOffCluster
) {
	public isOn = this._proxy.attributeGetter((value) => value.enabled);

	public setOn = this._proxy.attributeSetter(
		'enabled',
		(enabled: boolean) => enabled
	);

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

export abstract class EwelinkLevelControlCluster extends ConfigurableCluster<EwelinkLevelControlClusterState>(
	DeviceLevelControlCluster
) {
	public currentLevel = this._proxy.attributeGetter((value) => value.level);

	// Does not exist, noop
	public startupLevel = this._proxy.attributeGetter(() => 1.0);

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	public setLevel = this._proxy.attributeSetter(
		'level',
		(args: { level: number; transitionTimeDs?: number }) => args.level
	);

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}

export class EwelinkTemperatureMeasurementCluster extends ConfigurableCluster<{
	temperature: string;
}>(DeviceTemperatureMeasurementCluster) {
	public temperature = this._proxy.attributeGetter((value) =>
		value.temperature ? Number(value.temperature) / 100 : null
	);
}

export class EwelinkRelativeHumidityMeasurementCluster extends ConfigurableCluster<{
	humidity: string;
}>(DeviceRelativeHumidityMeasurementCluster) {
	public relativeHumidity = this._proxy.attributeGetter((value) =>
		value.humidity ? Number(value.humidity) / 10000 : null
	);
}

export class EwelinkPowerSourceCluster extends ConfigurableCluster<{
	battery: number;
}>(DevicePowerSourceCluster) {
	public batteryChargeLevel = this._proxy.attributeGetter((value) =>
		value.battery ? Number(value.battery) / 100 : null
	);
}

export abstract class EwelinkBooleanStateCluster extends ConfigurableCluster<{
	state: boolean;
}>(DeviceBooleanStateCluster) {
	public state = this._proxy.attributeGetter((value) => value.state);
}

export class EwelinkOccupancySensingCluster extends ConfigurableCluster<{
	motion: 0 | 1;
}>(DeviceOccupancySensingCluster) {
	public occupancy = this._proxy.attributeGetter(
		(value) => value.motion === 1
	);
}

export class EwelinkSwitchCluster extends ConfigurableCluster<{
	key: 0 | 1;
}>(DeviceSwitchCluster) {
	public onPress = this._proxy.eventListener((value) => value.key === 0);
	public onDoublePress = this._proxy.eventListener(
		(value) => value.key === 1
	);
}

export class EwelinkOutletSwitchCluster extends ConfigurableCluster<{
	key: 0 | 1;
	outlet: number;
}>(DeviceSwitchCluster) {
	public constructor(
		protected override readonly _eWeLinkConfig: EWeLinkConfig,
		public readonly outlet: number
	) {
		super(_eWeLinkConfig);
	}

	public onPress = this._proxy.eventListener(
		(value) => value.key === 0 && value.outlet === this.outlet
	);

	public onDoublePress = this._proxy.eventListener(
		(value) => value.key === 1 && value.outlet === this.outlet
	);
}
