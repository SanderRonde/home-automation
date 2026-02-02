import type {
	TuyaAPI,
	TuyaProperty,
	TuyaPropertyBitmapValue,
	TuyaPropertyBoolValue,
	TuyaPropertyEnumValue,
	TuyaPropertyNumberValue,
	TuyaPropertyRawValue,
	TuyaPropertyValue,
} from '../client/api';
import { DeviceThermostatCluster, ThermostatMode } from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import { TUYA_API_SOURCE } from '../client/api-tracker';
import { Data, MappedData } from '../../../lib/data';

class TuyaClusterProxy<PARAMS extends Record<string, TuyaPropertyValue>> {
	protected readonly _listeners = new Set<(data: PARAMS | undefined, isNew: boolean) => void>();
	private readonly _disposables = new Set<() => void>();
	public onChange: EventEmitter<void> = new EventEmitter();

	public constructor(
		private readonly _api: TuyaAPI,
		private readonly _deviceId: string
	) {
		const intervalMs = this._api.pollingIntervalMs;
		const interval = setInterval(async () => {
			const data = await this._refreshData(TUYA_API_SOURCE.polling);
			for (const listener of this._listeners) {
				listener(data.properties as unknown as PARAMS | undefined, false);
			}
		}, intervalMs);
		this._disposables.add(() => clearInterval(interval));
	}

	private _lastData: Promise<{
		properties: Record<string, TuyaProperty> | undefined;
		timestamp: number;
	}> | null = null;

	private async _refreshData(source: string = TUYA_API_SOURCE.onDemand) {
		if (this._lastData && Date.now() - (await this._lastData).timestamp < 5 * 1000) {
			return this._lastData;
		}
		return (this._lastData = this._api.getPropertiesByCode(this._deviceId, source).then(
			(properties) => ({
				properties,
				timestamp: Date.now(),
			}),
			() => ({
				properties: undefined,
				timestamp: Date.now(),
			})
		));
	}

	public getter<R>(
		mapper: (properties: PARAMS | undefined) => R | undefined
	): Data<R | undefined> {
		const emitter = (() => {
			const refreshData = this._refreshData.bind(this);
			class cls extends Data<PARAMS | undefined> {
				public override async get(): Promise<PARAMS | undefined> {
					const result = (await refreshData()).properties as unknown as
						| PARAMS
						| undefined;
					this.set(result);
					return result;
				}
			}

			return new cls(undefined);
		})();

		const data = new MappedData<R | undefined, PARAMS | undefined>(emitter, mapper);
		data.subscribe((_value, isInitial) => {
			if (!isInitial) {
				return this.onChange.emit(undefined);
			}
		});
		this._listeners.add((data) => emitter.set(data));
		return data as Data<R>;
	}

	public setter<P extends Extract<keyof PARAMS, string>, V = PARAMS[P]['value']>(
		property: P,
		mapper?: (value: V) => PARAMS[P]['value']
	) {
		return async (value: V) => {
			const result = await this._api.setProperty(
				this._deviceId,
				property,
				mapper ? mapper(value) : (value as unknown as TuyaPropertyValue['value'])
			);
			if (!result) {
				throw new Error(`Failed to set property ${property}`);
			}
		};
	}

	public [Symbol.dispose](): void {
		this._listeners.clear();
		this._disposables.forEach((dispose) => dispose());
		this._disposables.clear();
	}
}

class ConfigurableCluster<PARAMS extends Record<string, TuyaPropertyValue>> {
	public proxy: TuyaClusterProxy<PARAMS>;
	public onChange: EventEmitter<void> = new EventEmitter();

	public constructor(
		public readonly api: TuyaAPI,
		public readonly deviceId: string
	) {
		this.proxy = new TuyaClusterProxy(api, deviceId);
	}

	public [Symbol.dispose](): void {
		this.proxy[Symbol.dispose]();
	}
}

/** Temperature in celcius times 10. So 200 is 20°C */
type TuyaPropertyCelciusValue = TuyaPropertyNumberValue;

export class TuyaThermostatCluster
	extends ConfigurableCluster<{
		switch: TuyaPropertyBoolValue;
		mode: TuyaPropertyEnumValue<'auto' | 'home' | 'away' | 'temporary'>;
		temp_set: TuyaPropertyCelciusValue;
		temp_current: TuyaPropertyCelciusValue;
		temp_correction: TuyaPropertyCelciusValue;
		fault: TuyaPropertyBitmapValue;
		upper_temp: TuyaPropertyCelciusValue;
		lower_temp: TuyaPropertyCelciusValue;
		battery_percentage: TuyaPropertyNumberValue;
		child_lock: TuyaPropertyBoolValue;
		work_state: TuyaPropertyEnumValue<'stop' | 'heating'>;
		frost: TuyaPropertyBoolValue;
		dormant_switch: TuyaPropertyBoolValue;
		dormant_time_set: TuyaPropertyRawValue;
		factory_reset: TuyaPropertyBoolValue;
		work_days: TuyaPropertyEnumValue<'7' | '6_1' | '5_2' | 'off'>;
		qidongwencha: TuyaPropertyNumberValue;
		week_up_btn: TuyaPropertyBoolValue;
		week_program3: TuyaPropertyRawValue;
	}>
	implements DeviceThermostatCluster
{
	public getBaseCluster(): typeof DeviceThermostatCluster {
		return DeviceThermostatCluster;
	}

	public mode = this.proxy.getter((data) => {
		if (!data) {
			return undefined;
		}
		if (data.mode.value === 'auto') {
			return ThermostatMode.AUTO;
		}
		if (data.mode.value === 'home') {
			// Manual
			return ThermostatMode.HEAT;
		}
		if (data.mode.value === 'away') {
			// Manual
			return ThermostatMode.COOL;
		}
		if (data.mode.value === 'temporary') {
			return ThermostatMode.MANUAL;
		}
		return undefined;
	});

	public targetTemperature = this.proxy.getter((data) => {
		if (!data) {
			return undefined;
		}
		return data.temp_set.value / 10;
	});

	public currentTemperature = this.proxy.getter((data) => {
		if (!data) {
			return undefined;
		}
		return data.temp_current.value / 10;
	});

	public isHeating = this.proxy.getter((data) => {
		if (!data) {
			return undefined;
		}
		return data.work_state.value === 'heating';
	});

	public setTargetTemperature = this.proxy.setter('temp_set', (value) => value * 10);

	public setMode = this.proxy.setter<'mode', ThermostatMode>('mode', (value) => {
		return (
			{
				[ThermostatMode.AUTO]: 'auto',
				[ThermostatMode.HEAT]: 'home',
				[ThermostatMode.COOL]: 'away',
				[ThermostatMode.MANUAL]: 'home',
				[ThermostatMode.OFF]: 'away',
			} as const
		)[value];
	});
}
