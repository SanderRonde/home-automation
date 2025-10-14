import type { EventEmitter } from '../../lib/event-emitter';
import type { Color } from '../../lib/color';
import type { Data } from '../../lib/data';

export type DeviceGroupId = number & {
	__brand: 'DeviceGroupId';
};

// Largely copied from matter spec
export enum DeviceStatus {
	/**
	 * Operation was successful.
	 */
	Success = 0,

	/**
	 * Operation was not successful.
	 */
	Failure = 1,
}

export abstract class Cluster implements Disposable {
	public abstract [Symbol.dispose](): void;
	public abstract getName(): DeviceClusterName;
	public abstract onChange: EventEmitter<void>;
}

export enum DeviceClusterName {
	ON_OFF = 'OnOff',
	WINDOW_COVERING = 'WindowCovering',
	LEVEL_CONTROL = 'LevelControl',
	POWER_SOURCE = 'PowerSource',
	GROUPS = 'Groups',
	OCCUPANCY_SENSING = 'OccupancySensing',
	TEMPERATURE_MEASUREMENT = 'TemperatureMeasurement',
	RELATIVE_HUMIDITY_MEASUREMENT = 'RelativeHumidityMeasurement',
	BOOLEAN_STATE = 'BooleanState',
	SWITCH = 'Switch',
	ILLUMINANCE_MEASUREMENT = 'IlluminanceMeasurement',
	COLOR_CONTROL = 'ColorControl',
}

export abstract class DeviceOnOffCluster extends Cluster {
	public static clusterName = DeviceClusterName.ON_OFF;

	public getName(): DeviceClusterName {
		return DeviceOnOffCluster.clusterName;
	}

	public abstract isOn: Data<boolean>;
	public abstract setOn(on: boolean): Promise<void>;
	public abstract toggle(): Promise<void>;
}

export abstract class DeviceWindowCoveringCluster extends Cluster {
	public static clusterName = DeviceClusterName.WINDOW_COVERING;

	public getName(): DeviceClusterName {
		return DeviceWindowCoveringCluster.clusterName;
	}

	// public abstract currentPositionLiftPercentage: Data<number>;
	/**
	 * A lift percentage of 0 means the cover is opened (to the top) and 100 means the cover is closed (to the bottom)
	 */
	public abstract targetPositionLiftPercentage: Data<number>;
	public abstract close(): Promise<void>;
	public abstract open(): Promise<void>;
	public abstract goToLiftPercentage(args: { percentage: number }): Promise<void>;
}

export abstract class DeviceLevelControlCluster extends Cluster {
	public static clusterName = DeviceClusterName.LEVEL_CONTROL;

	public getName(): DeviceClusterName {
		return DeviceLevelControlCluster.clusterName;
	}

	/**
	 * Float from 0 to 1
	 */
	public abstract currentLevel: Data<number>;
	/**
	 * Float from 0 to 1
	 */
	public abstract startupLevel: Data<number>;
	public abstract setLevel(args: { level: number; transitionTimeDs?: number }): Promise<void>;
	public abstract setStartupLevel(args: {
		level: number;
		transitionTimeDs?: number;
	}): Promise<void>;
	public abstract stop(): Promise<void>;
}

export abstract class DevicePowerSourceCluster extends Cluster {
	public static clusterName = DeviceClusterName.POWER_SOURCE;

	public getName(): DeviceClusterName {
		return DevicePowerSourceCluster.clusterName;
	}

	public abstract batteryChargeLevel: Data<number | null>;
}

export abstract class DeviceGroupsCluster extends Cluster {
	public static clusterName = DeviceClusterName.GROUPS;

	public getName(): DeviceClusterName {
		return DeviceGroupsCluster.clusterName;
	}

	public abstract addGroup(args: { groupId: number; groupName: string }): Promise<{
		status: DeviceStatus;
		groupId: DeviceGroupId;
	}>;
	public abstract listGroupMemberships(): Promise<{
		groupList: DeviceGroupId[];
	}>;
	public abstract getFilteredGroupMembership(args: { groupList: DeviceGroupId[] }): Promise<{
		groupList: DeviceGroupId[];
	}>;
	public abstract removeGroup(args: { groupId: DeviceGroupId }): Promise<{
		status: DeviceStatus;
		groupId: DeviceGroupId;
	}>;
}

export abstract class DeviceOccupancySensingCluster extends Cluster {
	public static clusterName = DeviceClusterName.OCCUPANCY_SENSING;

	public getName(): DeviceClusterName {
		return DeviceOccupancySensingCluster.clusterName;
	}

	public abstract occupancy: Data<boolean>;
}

export abstract class DeviceTemperatureMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.TEMPERATURE_MEASUREMENT;

	public getName(): DeviceClusterName {
		return DeviceTemperatureMeasurementCluster.clusterName;
	}

	/**
	 * Temperature in degrees Celsius
	 */
	public abstract temperature: Data<number>;
}

export abstract class DeviceRelativeHumidityMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT;

	public getName(): DeviceClusterName {
		return DeviceRelativeHumidityMeasurementCluster.clusterName;
	}

	/**
	 * Relative humidity as a float from 0 to 1
	 */
	public abstract relativeHumidity: Data<number>;
}

export abstract class DeviceBooleanStateCluster<S extends boolean> extends Cluster {
	public static clusterName = DeviceClusterName.BOOLEAN_STATE;

	public getName(): DeviceClusterName {
		return DeviceBooleanStateCluster.clusterName;
	}

	public abstract state: Data<S>;
}

export abstract class DeviceSwitchCluster extends Cluster {
	public static clusterName = DeviceClusterName.SWITCH;

	public getName(): DeviceClusterName {
		return DeviceSwitchCluster.clusterName;
	}

	public abstract onPress: EventEmitter<void>;
	public abstract onDoublePress: EventEmitter<void>;
}

export abstract class DeviceIlluminanceMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.ILLUMINANCE_MEASUREMENT;

	public getName(): DeviceClusterName {
		return DeviceIlluminanceMeasurementCluster.clusterName;
	}

	public abstract illuminance: Data<number>;
}

export abstract class DeviceColorControlCluster extends Cluster {
	public static clusterName = DeviceClusterName.COLOR_CONTROL;

	public getName(): DeviceClusterName {
		return DeviceColorControlCluster.clusterName;
	}

	public abstract color: Data<Color>;
	public abstract setColor(args: { color: Color; overDurationMs?: number }): Promise<void>;
}
