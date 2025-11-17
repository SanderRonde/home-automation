import {
	DeviceElectricalEnergyMeasurementCluster,
	DeviceElectricalPowerMeasurementCluster,
} from '../../device/cluster';
import { createEventEmitter } from '../../../lib/event-emitter';
import { Data } from '../../../lib/data';

export class HomeWizardElectricalEnergyMeasurementCluster extends DeviceElectricalEnergyMeasurementCluster {
	public readonly totalEnergy = new Data<bigint>(0n);
	public readonly totalEnergyPeriod = new Data<{ from: Date; to: Date } | undefined>(
		undefined
	);
	public readonly onChange = createEventEmitter<void>();

	public getBaseCluster(): typeof DeviceElectricalEnergyMeasurementCluster {
		return DeviceElectricalEnergyMeasurementCluster;
	}

	public [Symbol.dispose](): void {
		// Cleanup if needed
	}

	public updateEnergy(energyKwh: number): void {
		// Convert kWh to Wh (watt-hours)
		const energyWh = BigInt(Math.round(energyKwh * 1000));
		this.totalEnergy.set(energyWh);
		this.onChange.emit();
	}
}

export class HomeWizardElectricalPowerMeasurementCluster extends DeviceElectricalPowerMeasurementCluster {
	public readonly activePower = new Data<number | undefined>(undefined);
	public readonly onChange = createEventEmitter<void>();

	public getBaseCluster(): typeof DeviceElectricalPowerMeasurementCluster {
		return DeviceElectricalPowerMeasurementCluster;
	}

	public [Symbol.dispose](): void {
		// Cleanup if needed
	}

	public updatePower(powerW: number): void {
		this.activePower.set(powerW);
		this.onChange.emit();
	}
}
