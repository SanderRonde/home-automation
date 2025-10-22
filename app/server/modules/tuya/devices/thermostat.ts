import { DeviceThermostatCluster, ThermostatMode } from '../../device/cluster';
import { TuyaDevice, type TuyaDeviceEndpoint } from './device';
import { EventEmitter } from '../../../lib/event-emitter';
import { Data } from '../../../lib/data';
import type TuyAPI from 'tuyapi';

class TuyaThermostatCluster extends DeviceThermostatCluster {
	private readonly _device: TuyAPI;
	private readonly _onChange: EventEmitter<void> = new EventEmitter();

	private readonly _currentTemperature: Data<number>;
	private readonly _targetTemperature: Data<number>;
	private readonly _mode: Data<ThermostatMode>;
	private readonly _isHeating: Data<boolean>;
	private readonly _minTemperature: Data<number>;
	private readonly _maxTemperature: Data<number>;

	public get onChange(): EventEmitter<void> {
		return this._onChange;
	}

	public get currentTemperature(): Data<number> {
		return this._currentTemperature;
	}

	public get targetTemperature(): Data<number> {
		return this._targetTemperature;
	}

	public get mode(): Data<ThermostatMode> {
		return this._mode;
	}

	public get isHeating(): Data<boolean> {
		return this._isHeating;
	}

	public get minTemperature(): Data<number> {
		return this._minTemperature;
	}

	public get maxTemperature(): Data<number> {
		return this._maxTemperature;
	}

	public constructor(device: TuyAPI) {
		super();
		this._device = device;
		this._currentTemperature = new Data(20); // Default values
		this._targetTemperature = new Data(20);
		this._mode = new Data(ThermostatMode.OFF);
		this._isHeating = new Data(false);
		this._minTemperature = new Data(5);
		this._maxTemperature = new Data(35);
	}

	public async setTargetTemperature(temperature: number): Promise<void> {
		const clampedTemp = Math.max(
			this._minTemperature.current(),
			Math.min(this._maxTemperature.current(), temperature)
		);
		await this._device.set({ dps: 2, set: clampedTemp });
		this._targetTemperature.set(clampedTemp);
		this._onChange.emit(undefined);
	}

	public async setMode(mode: ThermostatMode): Promise<void> {
		// Map mode to Tuya switch state
		const switchState = mode !== ThermostatMode.OFF;
		await this._device.set({ dps: 1, set: switchState });
		this._mode.set(mode);
		this._onChange.emit(undefined);
	}

	public updateFromDevice(dps: Record<string, unknown>): void {
		let changed = false;

		// DPS 1: Switch (on/off)
		if ('1' in dps && typeof dps['1'] === 'boolean') {
			const newMode = dps['1'] ? ThermostatMode.HEAT : ThermostatMode.OFF;
			if (newMode !== this._mode.current()) {
				this._mode.set(newMode);
				changed = true;
			}
		}

		// DPS 2: Target temperature
		if ('2' in dps && typeof dps['2'] === 'number') {
			if (dps['2'] !== this._targetTemperature.current()) {
				this._targetTemperature.set(dps['2']);
				changed = true;
			}
		}

		// DPS 3: Current temperature
		if ('3' in dps && typeof dps['3'] === 'number') {
			const tempCelsius = dps['3'] / 10; // Tuya often reports in 0.1°C units
			if (tempCelsius !== this._currentTemperature.current()) {
				this._currentTemperature.set(tempCelsius);
				changed = true;
			}
		}

		// DPS 4: Mode (heat/cool/auto)
		if ('4' in dps && typeof dps['4'] === 'string') {
			const modeMap: Record<string, ThermostatMode> = {
				hot: ThermostatMode.HEAT,
				cold: ThermostatMode.COOL,
				auto: ThermostatMode.AUTO,
			};
			const newMode = modeMap[dps['4']] || this._mode.current();
			if (newMode !== this._mode.current()) {
				this._mode.set(newMode);
				changed = true;
			}
		}

		// Determine if heating based on current vs target
		const wasHeating = this._isHeating.current();
		const isHeating =
			this._mode.current() !== ThermostatMode.OFF &&
			this._currentTemperature.current() < this._targetTemperature.current();
		if (isHeating !== wasHeating) {
			this._isHeating.set(isHeating);
			changed = true;
		}

		if (changed) {
			this._onChange.emit(undefined);
		}
	}

	public [Symbol.dispose](): void {
		// Cleanup if needed
	}
}

export class TuyaThermostatDevice extends TuyaDevice {
	public readonly onChange: EventEmitter<void> = new EventEmitter();
	public readonly clusters: TuyaThermostatCluster[];
	public readonly endpoints: TuyaDeviceEndpoint[] = [];
	private readonly _thermostatCluster: TuyaThermostatCluster;

	public constructor(name: string, deviceId: string, deviceKey: string, device: TuyAPI) {
		super(name, deviceId, deviceKey, device);
		this._thermostatCluster = new TuyaThermostatCluster(device);
		this.clusters = [this._thermostatCluster];

		// Listen for cluster changes
		this._thermostatCluster.onChange.listen(() => {
			this.onChange.emit(undefined);
		});

		// Listen for device data updates
		device.on('data', (data) => {
			if (data && typeof data === 'object' && 'dps' in data) {
				this._thermostatCluster.updateFromDevice(data.dps as Record<string, unknown>);
			}
		});
	}

	public getThermostatCluster(): TuyaThermostatCluster {
		return this._thermostatCluster;
	}
}
