import {
	DeviceClusterName,
	DeviceOnOffCluster,
	DeviceThreeDPrinterCluster,
} from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import { MappedData } from '../../../lib/data';
import type { Data } from '../../../lib/data';
import type { PrintState } from '../types';
import type { BambuLabAPI } from './api';

export class BambuLabLightOnOffCluster implements DeviceOnOffCluster {
	public static clusterName = DeviceClusterName.ON_OFF;

	public constructor(
		private readonly lightName: 'chamber_light',
		private readonly api: BambuLabAPI
	) {
		this.isOn = new MappedData(api.status, (status) => status?.lights?.[lightName] ?? false);
		this.isOn.subscribe(() => this.onChange.emit(undefined));
	}

	public onChange: EventEmitter<void> = new EventEmitter<void>();

	public getBaseCluster(): typeof DeviceOnOffCluster {
		return DeviceOnOffCluster;
	}

	public isOn: Data<boolean>;
	public setOn(on: boolean): Promise<void> {
		return this.api.setLight(this.lightName, on);
	}
	public toggle(): Promise<void> {
		return this.setOn(!this.isOn.current());
	}

	public [Symbol.dispose](): void {
		// Nothing to dispose
	}
}

export class BambuLabThreeDPrinterCluster implements DeviceThreeDPrinterCluster {
	public static clusterName = DeviceClusterName.THREE_D_PRINTER;

	public constructor(api: BambuLabAPI) {
		this.printState = new MappedData(api.status, (status) => status?.state);
		this.bedTemperature = new MappedData(api.status, (status) => status?.bedTemperature);
		this.nozzleTemperature = new MappedData(api.status, (status) => status?.nozzleTemperature);
		this.bedTargetTemperature = new MappedData(
			api.status,
			(status) => status?.bedTargetTemperature
		);
		this.nozzleTargetTemperature = new MappedData(
			api.status,
			(status) => status?.nozzleTargetTemperature
		);
		this.currentLayer = new MappedData(api.status, (status) => status?.layers?.current);
		this.totalLayers = new MappedData(api.status, (status) => status?.layers?.total);
		this.remainingTimeMinutes = new MappedData(api.status, (status) => status?.remainingTime);
		this.progress = new MappedData(api.status, (status) => status?.progress);
		this.currentFile = new MappedData(api.status, (status) => status?.currentFile);
		this.ams = new MappedData(api.status, (status) => status?.ams);
		this.usedTray = new MappedData(api.status, (status) => status?.ams?.usedTray);

		api.status.subscribe((status) => {
			if (!status) {
				return;
			}
			this.onChange.emit(undefined);
		});
	}

	public onChange: EventEmitter<void> = new EventEmitter<void>();

	public getBaseCluster(): typeof DeviceThreeDPrinterCluster {
		return DeviceThreeDPrinterCluster;
	}

	public printState: Data<PrintState | undefined>;
	public bedTemperature: Data<number | undefined>;
	public nozzleTemperature: Data<number | undefined>;
	public bedTargetTemperature: Data<number | undefined>;
	public nozzleTargetTemperature: Data<number | undefined>;
	public currentLayer: Data<number | undefined>;
	public totalLayers: Data<number | undefined>;
	public remainingTimeMinutes: Data<number | undefined>;
	public progress: Data<number | undefined>;
	public currentFile: Data<string | undefined>;
	public ams: Data<
		| {
				temp: number;
				humidity: number;
				trays: (
					| {
							empty: true;
					  }
					| {
							empty: false;
							color: string;
							type: string;
							remaining: number;
					  }
				)[];
		  }
		| undefined
	>;
	public usedTray: Data<number | undefined>;

	public [Symbol.dispose](): void {
		// Nothing to dispose
	}
}
