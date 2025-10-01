/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	EwelinkOccupancySensingCluster,
	EwelinkOutletSwitchCluster,
	EwelinkPowerSourceCluster,
	EwelinkRelativeHumidityMeasurementCluster,
	EwelinkSwitchCluster,
	EwelinkTemperatureMeasurementCluster,
} from './cluster';
import { EwelinkBooleanStateDoorSensorCluster } from './clusters/boolean-state/door-sensor';
import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import { EwelinkOnOffClusterSimplePower } from './clusters/power/simple-power';
import type { EwelinkOnOffClusterM51CParams } from './clusters/power/M5-1C';
import { EwelinkOnOffClusterM51CSingle } from './clusters/power/M5-1C';
import type { EWeLinkConfig } from './clusters/shared';
import { logTag } from '../../../lib/logging/logger';
import type { EwelinkCluster } from './cluster';

class EwelinkEndpoint extends DeviceEndpoint implements Disposable {
	public constructor(
		protected readonly _eWeLinkConfig: EWeLinkConfig,
		public readonly clusters: EwelinkCluster[],
		public readonly endpoints: EwelinkEndpoint[] = []
	) {
		super();
	}
}

export abstract class EwelinkDevice
	extends EwelinkEndpoint
	implements Device, Disposable
{
	public getUniqueId(): string {
		return `${this.getSource().value}:${this._eWeLinkConfig.device.itemData.deviceid}`;
	}

	public getDeviceName(): string {
		return this._eWeLinkConfig.device.itemData.name;
	}

	public getSource(): DeviceSource {
		return DeviceSource.EWELINK;
	}

	public static from(eWeLinkConfig: EWeLinkConfig): EwelinkDevice | null {
		const model = eWeLinkConfig.device.itemData.productModel;
		const device = DEVICES.find((d) => d.modelName === model);
		if (!device) {
			if (!IGNORED_DEVICES.includes(model)) {
				logTag(
					'ewelink',
					'red',
					`Unsupported device model: ${model}`,
					eWeLinkConfig.device.itemData
				);
			}
			return null;
		}
		return new device(eWeLinkConfig);
	}
}

class EwelinkM51CDevice extends EwelinkDevice {
	public static readonly modelName = 'M5-1C';

	public switches: number;
	public constructor(eWeLinkConfig: EWeLinkConfig) {
		const count = (
			eWeLinkConfig.device.itemData
				.params as unknown as EwelinkOnOffClusterM51CParams
		).switches.length;
		const outlets = Array.from(
			{ length: count },
			(_, i) =>
				new EwelinkEndpoint(
					eWeLinkConfig,
					[new EwelinkOnOffClusterM51CSingle(eWeLinkConfig, i)],
					[]
				)
		);
		super(eWeLinkConfig, [], outlets);
		this.switches = count;
	}
}

class EwelinkZBMiniDevice extends EwelinkDevice {
	public static readonly modelName = 'ZCL_HA_DEVICEID_ON_OFF_LIGHT';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		super(eWeLinkConfig, [
			new EwelinkOnOffClusterSimplePower(eWeLinkConfig),
		]);
	}
}

class EwelinkTemperatureHumiditySensorDevice extends EwelinkDevice {
	public static readonly modelName = 'SNZB-02P';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		super(eWeLinkConfig, [
			new EwelinkTemperatureMeasurementCluster(eWeLinkConfig),
			new EwelinkRelativeHumidityMeasurementCluster(eWeLinkConfig),
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

class EwelinkDoorAndWindowSensorDevice extends EwelinkDevice {
	public static readonly modelName = 'ZIGBEE_DOOR_AND_WINDOW_SENSOR';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		super(eWeLinkConfig, [
			new EwelinkBooleanStateDoorSensorCluster(eWeLinkConfig),
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

class EwelinkOccupancySensordevice extends EwelinkDevice {
	public static readonly modelName = 'ZIGBEE_MOBILE_SENSOR';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		super(eWeLinkConfig, [
			new EwelinkOccupancySensingCluster(eWeLinkConfig),
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

class EwelinkOnOffSwitchDevice extends EwelinkDevice {
	public static readonly modelName = 'zigbee_ON_OFF_SWITCH_1000';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		super(eWeLinkConfig, [
			new EwelinkSwitchCluster(eWeLinkConfig),
			new EwelinkPowerSourceCluster(eWeLinkConfig),
		]);
	}
}

class EwelinkR5SceneControllerDevice extends EwelinkDevice {
	public static readonly modelName = 'NON-OTA-GL(174)';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		const endpoints = new Array(6)
			.fill(0)
			.map(
				(_, i) =>
					new EwelinkEndpoint(eWeLinkConfig, [
						new EwelinkOutletSwitchCluster(eWeLinkConfig, i),
					])
			);
		super(
			eWeLinkConfig,
			[new EwelinkPowerSourceCluster(eWeLinkConfig)],
			endpoints
		);
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
	EwelinkZBMiniDevice,
] satisfies {
	modelName: string;
}[];
