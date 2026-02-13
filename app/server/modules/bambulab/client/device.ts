import { BambuLabLightOnOffCluster, BambuLabThreeDPrinterCluster } from './cluster';
import { DeviceEndpoint, DeviceSource } from '../../device/device';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Cluster } from '../../device/cluster';
import type { Device } from '../../device/device';
import type { BambuLabAPI } from './api';

export class BambuLabP1PDevice extends DeviceEndpoint implements Device {
	public readonly clusters: Cluster[];
	public readonly endpoints: DeviceEndpoint[] = [];

	public readonly onChange: EventEmitter<void> = new EventEmitter();

	public constructor(private readonly _api: BambuLabAPI) {
		super();
		const printerCluster = new BambuLabThreeDPrinterCluster(_api);
		printerCluster.onChange.listen(() => this.onChange.emit(undefined));
		const lightCluster = new BambuLabLightOnOffCluster('chamber_light', _api);
		lightCluster.onChange.listen(() => this.onChange.emit(undefined));
		this.clusters = [printerCluster, lightCluster];
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve('Bambu Lab Printer');
	}

	public getDeviceStatus(): 'online' | 'offline' {
		return this._api.isConnected() ? 'online' : 'offline';
	}

	public getUniqueId(): string {
		return `${this.getSource().value}:${this._api.serial}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.BAMBU_LAB;
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}
}
