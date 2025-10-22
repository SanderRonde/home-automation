import { TuyaDevice, type TuyaDeviceEndpoint } from './device';
import { EventEmitter } from '../../../lib/event-emitter';
import { TuyaThermostatCluster } from './cluster';
import type TuyAPI from 'tuyapi';

export class TuyaThermostatDevice extends TuyaDevice {
	public readonly onChange: EventEmitter<void> = new EventEmitter();
	public readonly clusters: TuyaThermostatCluster[];
	public readonly endpoints: TuyaDeviceEndpoint[] = [];

	public constructor(name: string, deviceId: string, deviceKey: string, device: TuyAPI) {
		super(name, deviceId, deviceKey, device);
		this.clusters = [new TuyaThermostatCluster(device)];

		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => {
				this.onChange.emit(undefined);
			});
		}
	}
}
