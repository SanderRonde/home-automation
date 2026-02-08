import { DeviceEndpoint, Device as DeviceInterface, DeviceSource } from '../../../device/device';
import { EventEmitter } from '../../../../lib/event-emitter';
import adb, { Device } from '@devicefarmer/adbkit';
import { Cluster } from '../../../device/cluster';

export abstract class AndroidControlProfileClient
	extends DeviceEndpoint
	implements DeviceInterface
{
	public readonly clusters: Cluster[] = [];
	public readonly endpoints: DeviceEndpoint[] = [];

	public constructor(
		protected readonly _deviceId: string,
		protected readonly _device: Device | null
	) {
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
		return this._device ? 'online' : 'offline';
	}

	public static async findDevice(id: string) {
		const adbClient = adb.createClient({});
		const devices = (await adbClient.listDevices()) as Device[];
		for (const device of devices) {
			if (device.id === id) {
				return device;
			}
		}
		return null;
	}
}
