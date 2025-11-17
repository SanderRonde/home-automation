import { Device, DeviceType } from '../../device/device';
import type { Cluster } from '../../device/cluster';
import {
	HomeWizardElectricalEnergyMeasurementCluster,
	HomeWizardElectricalPowerMeasurementCluster,
} from './cluster';

export class HomeWizardDevice extends Device {
	public readonly clusters: Cluster[];
	public readonly endpoints = [];

	private readonly _energyCluster: HomeWizardElectricalEnergyMeasurementCluster;
	private readonly _powerCluster: HomeWizardElectricalPowerMeasurementCluster;

	public constructor(
		public readonly ip: string,
		private readonly _productType: string,
		private readonly _serial: string
	) {
		super(`homewizard-${_serial}`, `HomeWizard Energy (${_productType})`, DeviceType.OTHER);

		this._energyCluster = new HomeWizardElectricalEnergyMeasurementCluster();
		this._powerCluster = new HomeWizardElectricalPowerMeasurementCluster();

		this.clusters = [this._energyCluster, this._powerCluster];
	}

	public updateMeasurements(energyKwh: number, powerW: number): void {
		this._energyCluster.updateEnergy(energyKwh);
		this._powerCluster.updatePower(powerW);
	}

	public [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
	}
}
