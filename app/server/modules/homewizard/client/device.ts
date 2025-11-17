import {
	HomeWizardElectricalEnergyMeasurementCluster,
	HomeWizardElectricalPowerMeasurementCluster,
} from './cluster';
import { DeviceEndpoint, DeviceSource } from '../../device/device';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Cluster } from '../../device/cluster';
import type { Device } from '../../device/device';

export class HomeWizardDevice extends DeviceEndpoint implements Device {
	public readonly onChange: EventEmitter<void> = new EventEmitter();
	public readonly clusters: Cluster[];
	public readonly endpoints: DeviceEndpoint[] = [];

	private readonly _energyCluster: HomeWizardElectricalEnergyMeasurementCluster;
	private readonly _powerCluster: HomeWizardElectricalPowerMeasurementCluster;

	public constructor(
		public readonly ip: string,
		private readonly _productType: string,
		private readonly _serial: string
	) {
		super();

		this._energyCluster = new HomeWizardElectricalEnergyMeasurementCluster();
		this._powerCluster = new HomeWizardElectricalPowerMeasurementCluster();

		this.clusters = [this._energyCluster, this._powerCluster];

		// Listen to cluster changes
		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => this.onChange.emit(undefined));
		}
	}

	public getUniqueId(): string {
		return `homewizard-${this._serial}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.HOMEWIZARD;
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve(`HomeWizard Energy (${this._productType})`);
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(`http://${this.ip}`);
	}

	public updateMeasurements(energyKwh: number, powerW: number): void {
		this._energyCluster.updateEnergy(energyKwh);
		this._powerCluster.updatePower(powerW);
	}

	public [Symbol.dispose](): void {
		super[Symbol.dispose]();
	}
}
