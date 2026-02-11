import type { Device as DeviceInterface } from '../../../device/device';
import { DeviceEndpoint, DeviceSource } from '../../../device/device';
import { EventEmitter } from '../../../../lib/event-emitter';
import type { Cluster } from '../../../device/cluster';
import type { Device } from '@devicefarmer/adbkit';
import adb from '@devicefarmer/adbkit';

export abstract class AndroidControlProfileClient
	extends DeviceEndpoint
	implements DeviceInterface
{
	public readonly clusters: Cluster[] = [];
	public readonly endpoints: DeviceEndpoint[] = [];
	protected _connected: boolean = true;

	public constructor(protected readonly _deviceId: string) {
		super();
	}

	public getUniqueId(): string {
		return this._deviceId;
	}

	public getSource(): DeviceSource {
		return DeviceSource.ANDROID_CONTROL;
	}

	public onChange: EventEmitter<void> = new EventEmitter();

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}

	public getDeviceStatus(): 'online' | 'offline' {
		return this._connected ? 'online' : 'offline';
	}

	public async findDevice() {
		const adbClient = adb.createClient({});
		const devices = (await adbClient.listDevices()) as Device[];
		for (const device of devices) {
			if (device.id === this._deviceId) {
				this._connected = true;
				return this._connected;
			}
		}
		this._connected = false;
		return this._connected;
	}
}
