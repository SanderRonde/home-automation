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
import {
	AsyncEventEmitter,
	EventEmitter,
	MappedAsyncEventEmitter,
} from '../../../lib/event-emitter';
import type { EWeLinkWebSocketMessage } from './clusters/shared';
import { SettablePromise } from '../../../lib/settable-promise';
import type { EWeLinkConfig } from './clusters/shared';
import type { Cluster } from '../../device/cluster';
import type { EwelinkDeviceResponse } from '../api';
import util from 'util';

export class EwelinkClusterProxy<PARAMS extends object> implements Disposable {
	private _disposables: (() => void)[] = [];
	private _config = new SettablePromise<EWeLinkConfig>();
	private readonly _fromParams: (state: object) => PARAMS = (s) =>
		s as PARAMS;
	private readonly _toParams: (state: PARAMS) => object = (s) => s;
	private _lastParams: PARAMS | null = null;
	protected readonly _eventEmitters = new Set<
		EventEmitter<unknown, unknown>
	>();
	private _online: SettablePromise<boolean> = new SettablePromise();

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
			config.wsConnection.listen(
				(data: EWeLinkWebSocketMessage<PARAMS>) => {
					if (
						typeof data === 'string' ||
						!('action' in data) ||
						data.action !== 'update' ||
						data.deviceid !==
							this._getItemData(config.device).deviceid
					) {
						return;
					}

					this._lastParams = {
						...this._lastParams,
						...data.params,
					};
					for (const eventEmitter of this._eventEmitters) {
						void eventEmitter.emit(this._lastParams);
					}
				}
			)
		);

		if (config.device.itemData.online) {
			this._online.set(true);
		}

		this._disposables.push(
			config.periodicFetcher.listen((data: EwelinkDeviceResponse) => {
				if (data.itemData.online) {
					this._online.set(true);
				} else {
					this._online = new SettablePromise();
				}
				for (const eventEmitter of this._eventEmitters) {
					this._lastParams = this._fromParams(data.itemData.params);
					void eventEmitter.emit(this._lastParams);
				}
			})
		);
	}

	public eventListener(
		shouldTrigger: (value: PARAMS) => boolean
	): EventEmitter<void> {
		const eventEmitter = new EventEmitter<void>();

		const wsListener = new EventEmitter<PARAMS>();
		wsListener.listen((value) => {
			if (shouldTrigger(value)) {
				eventEmitter.emit(undefined);
			}
		});
		this._eventEmitters.add(wsListener);
		return eventEmitter;
	}

	public attributeGetter<R>(
		mapper: (value: PARAMS) => R
	): MappedAsyncEventEmitter<PARAMS | null, R | null> {
		const emitter = (() => {
			const emitter = new AsyncEventEmitter<PARAMS | null>(() =>
				this._config.value.then((config) =>
					this._getItemData(config.device)
				)
			);
			if (mapper) {
				return new MappedAsyncEventEmitter<PARAMS | null, R | null>(
					emitter,
					mapper
				);
			}
			return emitter;
		})();
		this._eventEmitters.add(emitter);
		return emitter as MappedAsyncEventEmitter<PARAMS | null, R | null>;
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
		for (const eventEmitter of this._eventEmitters) {
			eventEmitter[Symbol.dispose]();
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
		getName: () => string;
		getEmoji: () => string;
	}
) {
	return class extends Base {
		protected getProxy = EwelinkClusterProxy.createGetter<T>();

		public constructor(protected readonly _eWeLinkConfig: EWeLinkConfig) {
			super();
			this.getProxy().setConfig(this._eWeLinkConfig);
		}

		public [Symbol.dispose](): void {
			this.getProxy()[Symbol.dispose]();
		}
	};
}

export abstract class EwelinkOnOffCluster extends ConfigurableCluster<EwelinkOnOffClusterState>(
	DeviceOnOffCluster
) {
	public isOn = this.getProxy().attributeGetter((value) => value.enabled);

	public setOn = this.getProxy().attributeSetter(
		'enabled',
		(enabled: boolean) => enabled
	);

	public toggle = async (): Promise<void> => {
		const current = await this.isOn.value;
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
	public currentLevel = this.getProxy().attributeGetter(
		(value) => value.level
	);

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

export class EwelinkTemperatureMeasurementCluster extends ConfigurableCluster<{
	temperature: string;
}>(DeviceTemperatureMeasurementCluster) {
	public temperature = this.getProxy().attributeGetter((value) =>
		value.temperature ? Number(value.temperature) / 100 : null
	);
}

export class EwelinkRelativeHumidityMeasurementCluster extends ConfigurableCluster<{
	humidity: string;
}>(DeviceRelativeHumidityMeasurementCluster) {
	public relativeHumidity = this.getProxy().attributeGetter((value) =>
		value.humidity ? Number(value.humidity) / 10000 : null
	);
}

export class EwelinkPowerSourceCluster extends ConfigurableCluster<{
	battery: number;
}>(DevicePowerSourceCluster) {
	public batteryChargeLevel = this.getProxy().attributeGetter((value) =>
		value.battery ? Number(value.battery) / 100 : null
	);
}

export abstract class EwelinkBooleanStateCluster extends ConfigurableCluster<{
	state: boolean;
}>(DeviceBooleanStateCluster) {
	public state = this.getProxy().attributeGetter((value) => value.state);

	public [Symbol.dispose](): void {
		this.getProxy()[Symbol.dispose]();
	}
}

export class EwelinkOccupancySensingCluster extends ConfigurableCluster<{
	motion: 0 | 1;
}>(DeviceOccupancySensingCluster) {
	public occupancy = this.getProxy().attributeGetter(
		(value) => value.motion === 1
	);
}

export class EwelinkSwitchCluster extends ConfigurableCluster<{
	key: 0 | 1;
}>(DeviceSwitchCluster) {
	public onPress = this.getProxy().eventListener((value) => value.key === 0);
	public onDoublePress = this.getProxy().eventListener(
		(value) => value.key === 1
	);
}

export class EwelinkOutletSwitchCluster extends ConfigurableCluster<{
	key: 0 | 1;
	outlet: number;
}>(DeviceSwitchCluster) {
	public constructor(
		protected readonly _eWeLinkConfig: EWeLinkConfig,
		public readonly outlet: number
	) {
		super(_eWeLinkConfig);
	}

	public onPress = this.getProxy().eventListener(
		(value) => value.key === 0 && value.outlet === this.outlet
	);

	public onDoublePress = this.getProxy().eventListener(
		(value) => value.key === 1 && value.outlet === this.outlet
	);
}
