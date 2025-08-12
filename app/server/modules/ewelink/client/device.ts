/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	EwelinkOccupancySensingCluster,
	EwelinkOutletSwitchCluster,
	EwelinkPowerSourceCluster,
	EwelinkRelativeHumidityMeasurementCluster,
	EwelinkSwitchCluster,
	EwelinkTemperatureMeasurementCluster,
	type EwelinkCluster,
} from './cluster';
import { EwelinkBooleanStateDoorSensorCluster } from './clusters/boolean-state/door-sensor';
import type { EwelinkOnOffClusterM51CParams } from './clusters/power/M5-1C';
import { EwelinkOnOffClusterM51CSingle } from './clusters/power/M5-1C';
import type { EWeLinkSharedConfig } from './clusters/shared';
import { logTag } from '../../../lib/logging/logger';
import type { Device } from '../../device/device';

export abstract class EwelinkDevice implements Device, Disposable {
	public constructor(
		protected readonly _eWeLinkConfig: EWeLinkSharedConfig,
		public readonly clusters: EwelinkCluster<object>[]
	) {}

	public getUniqueId(): string {
		return `EWELINK:${this._eWeLinkConfig.device.itemData.deviceid}`;
	}

	public static from(
		eWeLinkConfig: EWeLinkSharedConfig
	): EwelinkDevice | null {
		const model = eWeLinkConfig.device.itemData.productModel;
		const device = DEVICES.find((d) => d.modelName === model);
		if (!device) {
			if (!IGNORED_DEVICES.includes(model)) {
				console.log(eWeLinkConfig.device.itemData);
				logTag('ewelink', 'red', `Unsupported device model: ${model}`);
			}
			return null;
		}
		return new device(eWeLinkConfig);
	}

	public [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
	}
}

class EwelinkM51CDevice extends EwelinkDevice {
	public static readonly modelName = 'M5-1C';

	public switches: number;
	public constructor(eWeLinkConfig: EWeLinkSharedConfig) {
		const count = (
			eWeLinkConfig.device.itemData
				.params as unknown as EwelinkOnOffClusterM51CParams
		).switches.length;
		const outlets = Array.from(
			{ length: count },
			(_, i) => new EwelinkOnOffClusterM51CSingle(eWeLinkConfig, i)
		);
		super(eWeLinkConfig, [
			...outlets,
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
		this.switches = count;
	}
}

class EwelinkTemperatureHumiditySensorDevice extends EwelinkDevice {
	public static readonly modelName = 'SNZB-02P';

	public constructor(eWeLinkConfig: EWeLinkSharedConfig) {
		super(eWeLinkConfig, [
			new EwelinkTemperatureMeasurementCluster(eWeLinkConfig),
			new EwelinkRelativeHumidityMeasurementCluster(eWeLinkConfig),
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

class EwelinkDoorAndWindowSensorDevice extends EwelinkDevice {
	public static readonly modelName = 'ZIGBEE_DOOR_AND_WINDOW_SENSOR';

	public constructor(eWeLinkConfig: EWeLinkSharedConfig) {
		super(eWeLinkConfig, [
			new EwelinkBooleanStateDoorSensorCluster(eWeLinkConfig),
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

class EwelinkOccupancySensordevice extends EwelinkDevice {
	public static readonly modelName = 'ZIGBEE_MOBILE_SENSOR';

	public constructor(eWeLinkConfig: EWeLinkSharedConfig) {
		super(eWeLinkConfig, [
			new EwelinkOccupancySensingCluster(eWeLinkConfig),
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

class EwelinkOnOffSwitchDevice extends EwelinkDevice {
	public static readonly modelName = 'zigbee_ON_OFF_SWITCH_1000';

	public constructor(eWeLinkConfig: EWeLinkSharedConfig) {
		super(eWeLinkConfig, [
			new EwelinkSwitchCluster(eWeLinkConfig),
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

class EwelinkR5SceneControllerDevice extends EwelinkDevice {
	public static readonly modelName = 'NON-OTA-GL(174)';

	public constructor(eWeLinkConfig: EWeLinkSharedConfig) {
		const outlets = new Array(6)
			.fill(0)
			.map((_, i) => new EwelinkOutletSwitchCluster(eWeLinkConfig, i));
		super(eWeLinkConfig, [
			...outlets,
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

const IGNORED_DEVICES = ['ZBBridge'];
const DEVICES = [
	EwelinkM51CDevice,
	EwelinkTemperatureHumiditySensorDevice,
	EwelinkDoorAndWindowSensorDevice,
	EwelinkOccupancySensordevice,
	EwelinkOnOffSwitchDevice,
	EwelinkR5SceneControllerDevice,
] satisfies {
	modelName: string;
}[];
