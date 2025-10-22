import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import type { EventEmitter } from '../../../lib/event-emitter';
import type TuyAPI from 'tuyapi';

export abstract class TuyaDeviceEndpoint extends DeviceEndpoint {
	protected readonly _device: TuyAPI;
	protected readonly _deviceId: string;
	protected readonly _deviceKey: string;
	protected readonly _name: string;

	public abstract readonly onChange: EventEmitter<void>;

	protected constructor(name: string, deviceId: string, deviceKey: string, device: TuyAPI) {
		super();
		this._name = name;
		this._deviceId = deviceId;
		this._deviceKey = deviceKey;
		this._device = device;
	}

	public async getDeviceName(): Promise<string> {
		return Promise.resolve(this._name);
	}
}

export abstract class TuyaDevice extends TuyaDeviceEndpoint implements Device {
	public abstract readonly onChange: EventEmitter<void>;

	protected constructor(name: string, deviceId: string, deviceKey: string, device: TuyAPI) {
		super(name, deviceId, deviceKey, device);
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this._deviceId}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.TUYA;
	}

	public getManagementUrl(): string | undefined {
		return undefined;
	}
}
