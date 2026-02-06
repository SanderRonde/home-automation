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
import { EwelinkMultiOnOffCluster } from './clusters/power/multi-on-off';
import { EventEmitter } from '../../../lib/event-emitter';
import type { EWeLinkConfig } from './clusters/shared';
import { logTag } from '../../../lib/logging/logger';
import type { EwelinkCluster } from './cluster';

class EwelinkEndpoint extends DeviceEndpoint implements Disposable {
	public readonly onChange: EventEmitter<void> = new EventEmitter();
	private _disposables: (() => void)[] = [];

	public constructor(
		protected readonly _eWeLinkConfig: EWeLinkConfig,
		public readonly clusters: EwelinkCluster[],
		public readonly endpoints: EwelinkEndpoint[] = []
	) {
		super();
		for (const cluster of this.clusters) {
			cluster.onChange.listen(() => this.onChange.emit(undefined));
		}
		for (const endpoint of this.endpoints) {
			endpoint.onChange.listen(() => this.onChange.emit(undefined));
		}
		this._disposables.push(
			_eWeLinkConfig.periodicFetcher.subscribe((data) => {
				if (!data) {
					return;
				}
				_eWeLinkConfig.device = data;
			})
		);
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve(this._eWeLinkConfig.device.itemData.name);
	}

	public [Symbol.dispose](): void {
		for (const disposable of this._disposables) {
			disposable();
		}
	}
}

export abstract class EwelinkDevice extends EwelinkEndpoint implements Device, Disposable {
	public getUniqueId(): string {
		return `${this.getSource().value}:${this._eWeLinkConfig.device.itemData.deviceid}`;
	}

	public getDeviceId(): string {
		return this._eWeLinkConfig.device.itemData.deviceid;
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

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}

	public getDeviceStatus(): 'online' | 'offline' {
		if (this._eWeLinkConfig.device.itemData.deviceid === 'a480062a7c') {
			// Bit hacky but this one is broken so always shows offline
			return 'online';
		}
		return this._eWeLinkConfig.device.itemData.online ? 'online' : 'offline';
	}

	public reconnect = null;
}

class EwelinkM51CDevice extends EwelinkDevice {
	public static readonly modelName = 'M5-1C';

	public switches: number;
	public constructor(eWeLinkConfig: EWeLinkConfig) {
		// const count = (
		// 	eWeLinkConfig.device.itemData.params as unknown as EwelinkOnOffClusterM51CParams
		// ).switches.length;
		// For now forcibly use just 1 outlet
		const count = 1;
		const outlets = Array.from(
			{ length: count },
			(_, i) =>
				new EwelinkEndpoint(
					eWeLinkConfig,
					[new EwelinkMultiOnOffCluster(eWeLinkConfig, i)],
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
		super(eWeLinkConfig, [new EwelinkOnOffClusterSimplePower(eWeLinkConfig)]);
	}
}

class EwelinkMiniExtremeDevice extends EwelinkDevice {
	public static readonly modelName = 'MINIR4M';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		super(eWeLinkConfig, [new EwelinkMultiOnOffCluster(eWeLinkConfig, 0)]);
	}
}

class EwelinkSmartSwitchDevice extends EwelinkDevice {
	public static readonly modelName = 'ZBM5-2C-120';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		super(eWeLinkConfig, [
			new EwelinkMultiOnOffCluster(eWeLinkConfig, 0),
			// new EwelinkMultiOnOffCluster(eWeLinkConfig, 1),
		]);
	}
}

class EwelinkMicroDevice extends EwelinkDevice {
	public static readonly modelName = 'Micro';

	public constructor(eWeLinkConfig: EWeLinkConfig) {
		super(eWeLinkConfig, [new EwelinkMultiOnOffCluster(eWeLinkConfig, 0)]);
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
		const outletNames = [
			'Top left',
			'Top middle',
			'Top right',
			'Bottom left',
			'Bottom middle',
			'Bottom right',
		];
		const endpoints = new Array(6).fill(0).map(
			(_, i, arr) =>
				new EwelinkEndpoint(eWeLinkConfig, [
					new EwelinkOutletSwitchCluster(eWeLinkConfig, arr.length, {
						index: i,
						label: outletNames[i],
					}),
				])
		);
		super(eWeLinkConfig, [new EwelinkPowerSourceCluster(eWeLinkConfig)], endpoints);
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
	EwelinkMiniExtremeDevice,
	EwelinkSmartSwitchDevice,
	EwelinkMicroDevice,
] satisfies {
	modelName: string;
}[];
