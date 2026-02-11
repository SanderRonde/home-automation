import { SmartThingsFridgeCluster, SmartThingsWasherCluster } from './cluster';
import type { SmartAppContext, SmartThingsDeviceData } from './cluster';
import { DeviceEndpoint, DeviceSource } from '../../device/device';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Cluster } from '../../device/cluster';
import type { Device } from '../../device/device';

export abstract class SmartThingsDevice extends DeviceEndpoint implements Device {
	public readonly onChange: EventEmitter<void> = new EventEmitter();
	public readonly clusters: Cluster[] = [];
	public readonly endpoints: DeviceEndpoint[] = [];

	public constructor(
		public readonly initialData: SmartThingsDeviceData,
		public readonly ctx: SmartAppContext
	) {
		super();
	}

	public abstract getDeviceName(): Promise<string>;

	public getUniqueId(): string {
		return `${this.getSource().value}:${this.initialData.deviceId}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.SMARTTHINGS;
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}

	public getDeviceStatus(): 'online' | 'offline' {
		return 'online';
	}
}

export class SmartThingsFridgeDevice extends SmartThingsDevice {
	public readonly clusters: Cluster[];

	public getDeviceName(): Promise<string> {
		return Promise.resolve('SmartThings Fridge');
	}

	public constructor(initialData: SmartThingsDeviceData, ctx: SmartAppContext) {
		super(initialData, ctx);
		this.clusters = [new SmartThingsFridgeCluster(initialData, ctx)];
		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => this.onChange.emit(undefined));
		}
	}
}

export class SmartThingsWasherDevice extends SmartThingsDevice {
	public readonly clusters: Cluster[];

	public getDeviceName(): Promise<string> {
		return Promise.resolve('SmartThings Washer');
	}

	public constructor(initialData: SmartThingsDeviceData, ctx: SmartAppContext) {
		super(initialData, ctx);
		this.clusters = [new SmartThingsWasherCluster(initialData, ctx)];
		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => this.onChange.emit(undefined));
		}
	}
}

export function getSmartThingsDevice(
	device: SmartThingsDeviceData,
	ctx: SmartAppContext
): Device | null {
	if (SmartThingsFridgeCluster.isInstance(device)) {
		return new SmartThingsFridgeDevice(device, ctx);
	}
	if (SmartThingsWasherCluster.isInstance(device)) {
		return new SmartThingsWasherDevice(device, ctx);
	}
	return null;
}
