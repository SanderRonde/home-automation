import { DeviceThermostatCluster, ThermostatMode, Cluster } from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import { Data } from '../../../lib/data';
import type { TuyaDeviceConfig } from '../api';

const TuyAPI = require('tuyapi');

export abstract class TuyaCluster extends Cluster {
	public readonly onChange: EventEmitter<void> = new EventEmitter();

	public constructor(
		protected readonly _deviceId: string,
		protected readonly _config: TuyaDeviceConfig,
		protected readonly _tuyaDevice: typeof TuyAPI,
		protected readonly _stateData: Data<Record<string, unknown> | undefined>
	) {
		super();

		// Listen to state changes
		this._stateData.subscribe(() => {
			this.onChange.emit(undefined);
		});
	}

	public [Symbol.dispose](): void {
		// Default implementation, subclasses can override
	}
}

interface TuyaThermostatState {
	// Common Tuya thermostat DPS points
	'1'?: boolean; // Switch (on/off)
	'2'?: number; // Target temperature (in tenths of degrees)
	'3'?: number; // Current temperature (in tenths of degrees)
	'4'?: string; // Mode: 'manual', 'auto', 'holiday', etc.
	'5'?: boolean; // Child lock
	'6'?: number; // Temperature unit (0 = Celsius, 1 = Fahrenheit)
	'7'?: boolean; // Heating state
}

export class TuyaThermostatCluster extends TuyaCluster implements DeviceThermostatCluster {
	public readonly currentTemperature: Data<number | undefined>;
	public readonly targetTemperature: Data<number | undefined>;
	public readonly mode: Data<ThermostatMode | undefined>;
	public readonly isHeating: Data<boolean>;
	public readonly role: 'master' | 'slave' = 'slave';

	public constructor(
		deviceId: string,
		config: TuyaDeviceConfig,
		tuyaDevice: typeof TuyAPI,
		stateData: Data<Record<string, unknown> | undefined>,
		role: 'master' | 'slave'
	) {
		super(deviceId, config, tuyaDevice, stateData);
		// Cast to writable for initialization
		(this as { role: 'master' | 'slave' }).role = role;

		// Initialize data from state
		const state = this._stateData.current() as TuyaThermostatState | undefined;

		this.currentTemperature = new Data<number | undefined>(
			state?.['3'] !== undefined ? state['3'] / 10 : undefined
		);
		this.targetTemperature = new Data<number | undefined>(
			state?.['2'] !== undefined ? state['2'] / 10 : undefined
		);
		this.isHeating = new Data<boolean>(state?.['7'] ?? false);
		this.mode = new Data<ThermostatMode | undefined>(this._parseTuyaMode(state?.['4']));

		// Subscribe to state updates
		this._stateData.subscribe(() => {
			const newState = this._stateData.current() as TuyaThermostatState | undefined;
			if (newState?.['3'] !== undefined) {
				this.currentTemperature.set(newState['3'] / 10);
			}
			if (newState?.['2'] !== undefined) {
				this.targetTemperature.set(newState['2'] / 10);
			}
			if (newState?.['7'] !== undefined) {
				this.isHeating.set(newState['7']);
			}
			if (newState?.['4'] !== undefined) {
				this.mode.set(this._parseTuyaMode(newState['4']));
			}
		});
	}

	private _parseTuyaMode(tuyaMode: string | undefined): ThermostatMode | undefined {
		if (!tuyaMode) return undefined;
		switch (tuyaMode.toLowerCase()) {
			case 'manual':
			case 'heat':
				return ThermostatMode.HEAT;
			case 'cool':
				return ThermostatMode.COOL;
			case 'auto':
				return ThermostatMode.AUTO;
			case 'off':
			default:
				return ThermostatMode.OFF;
		}
	}

	private _toTuyaMode(mode: ThermostatMode): string {
		switch (mode) {
			case ThermostatMode.HEAT:
				return 'manual';
			case ThermostatMode.COOL:
				return 'cool';
			case ThermostatMode.AUTO:
				return 'auto';
			case ThermostatMode.OFF:
			default:
				return 'off';
		}
	}

	public async setTargetTemperature(temperature: number): Promise<void> {
		// Tuya expects temperature in tenths of degrees
		const tuyaTemp = Math.round(temperature * 10);
		await this._tuyaDevice.set({ dps: '2', set: tuyaTemp });
	}

	public async setMode(mode: ThermostatMode): Promise<void> {
		const tuyaMode = this._toTuyaMode(mode);
		await this._tuyaDevice.set({ dps: '4', set: tuyaMode });

		// Also set the switch state based on mode
		const switchState = mode !== ThermostatMode.OFF;
		await this._tuyaDevice.set({ dps: '1', set: switchState });
	}

	public getBaseCluster() {
		return DeviceThermostatCluster;
	}
}
