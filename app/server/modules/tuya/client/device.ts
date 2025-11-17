import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import { TuyaThermostatCluster, type TuyaCluster } from './cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import type { TuyaDeviceConfig } from '../api';
import { Data } from '../../../lib/data';

const TuyAPI = require('tuyapi');

class TuyaEndpoint extends DeviceEndpoint implements Disposable {
	public readonly onChange: EventEmitter<void> = new EventEmitter();

	public constructor(
		protected readonly _deviceId: string,
		protected readonly _config: TuyaDeviceConfig,
		public readonly clusters: TuyaCluster[],
		public readonly endpoints: TuyaEndpoint[] = []
	) {
		super();
		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => this.onChange.emit(undefined));
		}
		for (const endpoint of this.endpoints) {
			endpoint.onChange.listen(() => this.onChange.emit(undefined));
		}
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve(this._deviceId);
	}
}

export abstract class TuyaDevice extends TuyaEndpoint implements Device, Disposable {
	public getUniqueId(): string {
		return `${this.getSource().value}:${this._deviceId}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.TUYA;
	}

	public static from(
		deviceId: string,
		config: TuyaDeviceConfig,
		tuyaDevice: typeof TuyAPI,
		stateData: Data<Record<string, unknown> | undefined>
	): TuyaDevice | null {
		// For now, we'll default to creating thermostat devices
		// In the future, this can be extended to support different device types
		// based on device capabilities or configuration
		const role = config.role ?? 'slave';
		return new TuyaThermostatDevice(deviceId, config, tuyaDevice, stateData, role);
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}
}

export class TuyaThermostatDevice extends TuyaDevice {
	public constructor(
		deviceId: string,
		config: TuyaDeviceConfig,
		tuyaDevice: typeof TuyAPI,
		stateData: Data<Record<string, unknown> | undefined>,
		role: 'master' | 'slave'
	) {
		super(
			deviceId,
			config,
			[new TuyaThermostatCluster(deviceId, config, tuyaDevice, stateData, role)],
			[]
		);
	}
}
