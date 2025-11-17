import {
	DeviceElectricalEnergyMeasurementCluster,
	DeviceElectricalPowerMeasurementCluster,
} from '../device/cluster';
import type { Device } from '../device/device';
import type { Cluster } from '../device/cluster';
import { DeviceEndpoint, DeviceSource } from '../device/device';
import type { Data } from '../../lib/data';
import { EventEmitter } from '../../lib/event-emitter';

type EnergyPeriod = Data<{ from: Date; to: Date } | undefined>;

class DataBackedCluster<T extends Cluster> {
	protected readonly onChange = new EventEmitter<void>();
	private readonly _unsubscribers: Array<() => void> = [];

	protected trackDataChanges(...dataSources: Data<unknown>[]): void {
		for (const source of dataSources) {
			const unsubscribe = source.subscribe((_value, isInitial) => {
				if (!isInitial) {
					this.onChange.emit(undefined);
				}
			});
			this._unsubscribers.push(unsubscribe);
		}
	}

	protected cleanup(): void {
		for (const unsubscribe of this._unsubscribers) {
			unsubscribe();
		}
		this._unsubscribers.length = 0;
	}

	public get changeEmitter(): EventEmitter<void> {
		return this.onChange;
	}
}

export class HomeWizardEnergyCluster
	extends DataBackedCluster<DeviceElectricalEnergyMeasurementCluster>
	implements DeviceElectricalEnergyMeasurementCluster
{
	public constructor(
		public readonly totalEnergy: Data<bigint>,
		public readonly totalEnergyPeriod: EnergyPeriod
	) {
		super();
		this.trackDataChanges(this.totalEnergy, this.totalEnergyPeriod);
	}

	public getBaseCluster(): typeof DeviceElectricalEnergyMeasurementCluster {
		return DeviceElectricalEnergyMeasurementCluster;
	}

	public readonly onChange = this.changeEmitter;

	public [Symbol.dispose](): void {
		this.cleanup();
	}
}

export class HomeWizardPowerCluster
	extends DataBackedCluster<DeviceElectricalPowerMeasurementCluster>
	implements DeviceElectricalPowerMeasurementCluster
{
	public constructor(public readonly activePower: Data<number | undefined>) {
		super();
		this.trackDataChanges(this.activePower);
	}

	public getBaseCluster(): typeof DeviceElectricalPowerMeasurementCluster {
		return DeviceElectricalPowerMeasurementCluster;
	}

	public readonly onChange = this.changeEmitter;

	public [Symbol.dispose](): void {
		this.cleanup();
	}
}

interface HomeWizardDeviceOptions {
	ip: string;
	name?: string;
	energy: Data<bigint>;
	energyPeriod: EnergyPeriod;
	power: Data<number | undefined>;
}

export class HomeWizardDevice extends DeviceEndpoint implements Device {
	public readonly onChange: EventEmitter<void> = new EventEmitter();
	public readonly endpoints: DeviceEndpoint[] = [];
	public readonly clusters: Cluster[];

	private readonly _energyCluster: HomeWizardEnergyCluster;
	private readonly _powerCluster: HomeWizardPowerCluster;
	private readonly _name: string;

	public constructor(private readonly _options: HomeWizardDeviceOptions) {
		super();
		this._name = _options.name ?? 'HomeWizard Energy';
		this._energyCluster = new HomeWizardEnergyCluster(
			_options.energy,
			_options.energyPeriod
		);
		this._powerCluster = new HomeWizardPowerCluster(_options.power);
		this.clusters = [this._energyCluster, this._powerCluster];

		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => {
				return this.onChange.emit(undefined);
			});
		}
	}

	public getUniqueId(): string {
		return `${DeviceSource.HOMEWIZARD.value}:${this._options.ip}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.HOMEWIZARD;
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve(this._name);
	}

	public getManagementUrl(): Promise<string | undefined> {
		const ip = this._options.ip.startsWith('http')
			? this._options.ip
			: `http://${this._options.ip}`;
		return Promise.resolve(ip);
	}

	public override [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
	}
}
