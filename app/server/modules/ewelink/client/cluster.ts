/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type {
	DeviceLevelControlCluster,
	DeviceTemperatureMeasurementCluster,
	DeviceOnOffCluster,
	DeviceRelativeHumidityMeasurementCluster,
	DevicePowerSourceCluster,
	DeviceBooleanStateCluster,
	DeviceOccupancySensingCluster,
	DeviceSwitchCluster,
} from '../../device/cluster';
import {
	EventEmitter,
	MappedAsyncEventEmitter,
} from '../../../lib/event-emitter';
import type { EWeLinkWebSocketMessage } from './clusters/shared';
import type { EWeLinkSharedConfig } from './clusters/shared';
import type { EwelinkDeviceResponse } from '../api';
import util from 'util';

class EwelinkClusterProxy<PARAMS extends object> implements Disposable {
	private _disposables: (() => void)[] = [];
	protected readonly _eventEmitters = new Set<
		EventEmitter<unknown, unknown>
	>();

	public constructor(private readonly _eWeLinkConfig: EWeLinkSharedConfig) {
		let lastParams: PARAMS | null = _eWeLinkConfig.device.itemData
			.params as PARAMS;
		this._disposables.push(
			this._eWeLinkConfig.wsConnection.listen(
				(data: EWeLinkWebSocketMessage<PARAMS>) => {
					if (
						typeof data === 'string' ||
						!('action' in data) ||
						data.action !== 'update' ||
						data.deviceid !==
							this._eWeLinkConfig.device.itemData.deviceid
					) {
						return;
					}

					lastParams = {
						...lastParams,
						...data.params,
					};
					for (const eventEmitter of this._eventEmitters) {
						void eventEmitter.emit(lastParams);
					}
				}
			)
		);
		this._disposables.push(
			this._eWeLinkConfig.periodicFetcher.listen(
				(data: EwelinkDeviceResponse) => {
					for (const eventEmitter of this._eventEmitters) {
						lastParams = data.itemData.params as PARAMS;
						void eventEmitter.emit(data.itemData.params);
					}
				}
			)
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
		const eventEmitter = new MappedAsyncEventEmitter<
			PARAMS | null,
			R | null
		>(mapper, () =>
			Promise.resolve(
				this._eWeLinkConfig.device.itemData.params as PARAMS
			)
		);
		this._eventEmitters.add(eventEmitter);
		return eventEmitter;
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

			await this._eWeLinkConfig.connection.setThingStatus({
				id: this._eWeLinkConfig.device.itemData.deviceid,
				type: 1,
				params: {
					[attribute]: mappedInput,
				},
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

export class EwelinkCluster<DATA extends object> implements Disposable {
	protected readonly proxy: EwelinkClusterProxy<DATA>;
	public constructor(protected readonly _eWeLinkConfig: EWeLinkSharedConfig) {
		this.proxy = new EwelinkClusterProxy<DATA>(_eWeLinkConfig);
	}

	public [Symbol.dispose](): void {
		this.proxy[Symbol.dispose]();
	}
}

abstract class MappedEwelinkCluster<
	IN extends object,
	OUT extends object,
> extends EwelinkCluster<OUT> {
	protected abstract _fromState(state: IN): OUT;

	protected abstract _toState(state: OUT): IN;
}

export interface EwelinkOnOffClusterState {
	enabled: boolean;
}

export abstract class EwelinkOnOffCluster<PARAMS extends object>
	extends MappedEwelinkCluster<PARAMS, EwelinkOnOffClusterState>
	implements DeviceOnOffCluster
{
	public isOn = this.proxy.attributeGetter((value) => value.enabled);

	public setOn = this.proxy.attributeSetter(
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

export abstract class EwelinkLevelControlCluster<PARAMS extends object>
	extends MappedEwelinkCluster<PARAMS, EwelinkLevelControlClusterState>
	implements DeviceLevelControlCluster
{
	public currentLevel = this.proxy.attributeGetter((value) => value.level);

	// Does not exist, noop
	public startupLevel = this.proxy.attributeGetter(() => 1.0);

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	public setLevel = this.proxy.attributeSetter(
		'level',
		(args: { level: number; transitionTimeDs?: number }) => args.level
	);

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}

export class EwelinkTemperatureMeasurementCluster
	extends EwelinkCluster<{ temperature: string }>
	implements DeviceTemperatureMeasurementCluster
{
	public temperature = this.proxy.attributeGetter((value) =>
		value.temperature ? Number(value.temperature) / 100 : null
	);
}

export class EwelinkRelativeHumidityMeasurementCluster
	extends EwelinkCluster<{ humidity: string }>
	implements DeviceRelativeHumidityMeasurementCluster
{
	public relativeHumidity = this.proxy.attributeGetter((value) =>
		value.humidity ? Number(value.humidity) / 10000 : null
	);
}

export class EwelinkPowerSourceCluster
	extends EwelinkCluster<{
		battery: number;
	}>
	implements DevicePowerSourceCluster
{
	public batteryChargeLevel = this.proxy.attributeGetter((value) =>
		value.battery ? Number(value.battery) / 100 : null
	);
}

export abstract class EwelinkBooleanStateCluster<PARAMS extends object>
	extends MappedEwelinkCluster<PARAMS, { state: boolean }>
	implements DeviceBooleanStateCluster<boolean>
{
	public state = this.proxy.attributeGetter((value) => value.state);
}

export class EwelinkOccupancySensingCluster
	extends EwelinkCluster<{
		motion: 0 | 1;
	}>
	implements DeviceOccupancySensingCluster
{
	public occupancy = this.proxy.attributeGetter(
		(value) => value.motion === 1
	);
}

export class EwelinkSwitchCluster
	extends EwelinkCluster<{
		key: 0 | 1;
	}>
	implements DeviceSwitchCluster
{
	public onPress = this.proxy.eventListener((value) => value.key === 0);
	public onDoublePress = this.proxy.eventListener((value) => value.key === 1);
}

export class EwelinkOutletSwitchCluster
	extends EwelinkCluster<{
		key: 0 | 1;
		outlet: number;
	}>
	implements DeviceSwitchCluster
{
	public constructor(
		eWeLinkConfig: EWeLinkSharedConfig,
		public readonly outlet: number
	) {
		super(eWeLinkConfig);
	}

	public onPress = this.proxy.eventListener(
		(value) => value.key === 0 && value.outlet === this.outlet
	);
	public onDoublePress = this.proxy.eventListener(
		(value) => value.key === 1 && value.outlet === this.outlet
	);
}
