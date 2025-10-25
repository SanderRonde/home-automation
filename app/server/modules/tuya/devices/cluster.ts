import {
	type DeviceClusterName,
	DeviceThermostatCluster,
	ThermostatMode,
} from '../../device/cluster';
import { CombinedData, Data, MappedData } from '../../../lib/data';
import { EventEmitter } from '../../../lib/event-emitter';
import type TuyaDeviceApi from 'tuyapi';

class TuyaThermostatClusterProxy {
	private _listeners: Set<(data: Record<string, unknown>) => void> = new Set();
	private _disposables: Set<() => void> = new Set();
	public onChange: EventEmitter<void> = new EventEmitter();

	public constructor(api: TuyaDeviceApi) {
		// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
		const listener = (data: Object) => {
			if (data && typeof data === 'object' && 'dps' in data) {
				for (const listener of this._listeners) {
					listener(data.dps as Record<string, unknown>);
				}
			}
		};
		api.on('data', listener);
		this._disposables.add(() => {
			api.off('data', listener);
		});
	}

	public attributeFromApi<T>(mapper: (data: Record<string, unknown>) => T | undefined) {
		const data = new Data<T | undefined>(undefined);
		this._listeners.add((dps) => {
			const mapped = mapper(dps);
			if (mapped !== undefined) {
				data.set(mapped);
				this.onChange.emit(undefined);
			}
		});
		return data;
	}

	public [Symbol.dispose](): void {
		this._listeners.clear();
	}
}

class ConfigurableCluster {
	public proxy: TuyaThermostatClusterProxy;
	public onChange: EventEmitter<void>;

	public constructor(public readonly device: TuyaDeviceApi) {
		this.proxy = new TuyaThermostatClusterProxy(device);
		this.onChange = this.proxy.onChange;
	}
}

export class TuyaThermostatCluster extends ConfigurableCluster implements DeviceThermostatCluster {
	public getName(): DeviceClusterName {
		return DeviceThermostatCluster.clusterName;
	}

	public mode = this.proxy.attributeFromApi((dps) => {
		if ('1' in dps && typeof dps['1'] === 'boolean') {
			if (!dps['1']) {
				return ThermostatMode.OFF;
			}
		}
		if ('4' in dps && typeof dps['4'] === 'string') {
			const modeMap: Record<string, ThermostatMode> = {
				hot: ThermostatMode.HEAT,
				cold: ThermostatMode.COOL,
				auto: ThermostatMode.AUTO,
			};
			if (modeMap[dps['4']]) {
				return modeMap[dps['4']];
			}
		}
		return undefined;
	});

	public targetTemperature = this.proxy.attributeFromApi((dps) => {
		if ('2' in dps && typeof dps['2'] === 'number') {
			return dps['2'];
		}
		return undefined;
	});

	public currentTemperature = this.proxy.attributeFromApi((dps) => {
		if ('3' in dps && typeof dps['3'] === 'number') {
			return dps['3'] / 10; // Tuya often reports in 0.1°C units
		}
		return undefined;
	});

	public isHeating = new MappedData(
		new CombinedData([
			this.mode,
			new CombinedData([this.currentTemperature, this.targetTemperature]),
		]),
		([mode, [current, target]]) =>
			current !== undefined && target !== undefined && mode !== undefined
				? mode !== ThermostatMode.OFF && current < target
				: false
	);

	public async setTargetTemperature(temperature: number): Promise<void> {
		await this.device.set({ dps: 2, set: temperature });
		this.targetTemperature.set(temperature);
		this.onChange.emit(undefined);
	}

	public async setMode(mode: ThermostatMode): Promise<void> {
		// Map mode to Tuya switch state
		const switchState = mode !== ThermostatMode.OFF;
		await this.device.set({ dps: 1, set: switchState });
		this.mode.set(mode);
		this.onChange.emit(undefined);
	}

	public [Symbol.dispose](): void {
		this.proxy[Symbol.dispose]();
	}
}
