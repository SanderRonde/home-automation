import type { EventEmitter } from '../../lib/event-emitter';
import type { DeviceAttribute } from './device';
import type { Color } from '../../lib/color';

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
}

export abstract class DeviceOnOffCluster extends Cluster {
	public static clusterName = 'OnOff';

	public abstract isOn: DeviceAttribute<boolean>;
	public abstract setOn(on: boolean): Promise<void>;
	public abstract toggle(): Promise<void>;
}

export abstract class DeviceWindowCoveringCluster extends Cluster {
	public static clusterName = 'WindowCovering';

	public abstract currentPositionLiftPercentage: DeviceAttribute<number>;
	public abstract targetPositionLiftPercentage: DeviceAttribute<number>;
	public abstract close(): Promise<void>;
	public abstract open(): Promise<void>;
	public abstract goToLiftPercentage(args: {
		percentage: number;
	}): Promise<void>;
}

export abstract class DeviceLevelControlCluster extends Cluster {
	public static clusterName = 'LevelControl';

	/**
	 * Float from 0 to 1
	 */
	public abstract currentLevel: DeviceAttribute<number>;
	/**
	 * Float from 0 to 1
	 */
	public abstract startupLevel: DeviceAttribute<number>;
	public abstract setLevel(args: {
		level: number;
		transitionTimeDs?: number;
	}): Promise<void>;
	public abstract setStartupLevel(args: {
		level: number;
		transitionTimeDs?: number;
	}): Promise<void>;
	public abstract stop(): Promise<void>;
}

export abstract class DevicePowerSourceCluster extends Cluster {
	public static clusterName = 'PowerSource';

	public abstract batteryChargeLevel: DeviceAttribute<number | null>;
}

export abstract class DeviceGroupsCluster extends Cluster {
	public static clusterName = 'Groups';

	public abstract addGroup(args: {
		groupId: number;
		groupName: string;
	}): Promise<{
		status: DeviceStatus;
		groupId: DeviceGroupId;
	}>;
	public abstract listGroupMemberships(): Promise<{
		groupList: DeviceGroupId[];
	}>;
	public abstract getFilteredGroupMembership(args: {
		groupList: DeviceGroupId[];
	}): Promise<{
		groupList: DeviceGroupId[];
	}>;
	public abstract removeGroup(args: { groupId: DeviceGroupId }): Promise<{
		status: DeviceStatus;
		groupId: DeviceGroupId;
	}>;
}

export abstract class DeviceOccupancySensingCluster extends Cluster {
	public static clusterName = 'OccupancySensing';

	public abstract occupancy: DeviceAttribute<boolean>;
}

export abstract class DeviceTemperatureMeasurementCluster extends Cluster {
	public static clusterName = 'TemperatureMeasurement';

	/**
	 * Temperature in degrees Celsius
	 */
	public abstract temperature: DeviceAttribute<number>;
}

export abstract class DeviceRelativeHumidityMeasurementCluster extends Cluster {
	/**
	 * Relative humidity as a float from 0 to 1
	 */
	public abstract relativeHumidity: DeviceAttribute<number>;
}

export abstract class DeviceBooleanStateCluster<
	S extends boolean,
> extends Cluster {
	public abstract state: DeviceAttribute<S>;
}

export abstract class DeviceSwitchCluster extends Cluster {
	public abstract onPress: EventEmitter<void>;
	public abstract onDoublePress: EventEmitter<void>;
}

export abstract class DeviceIlluminanceMeasurementCluster extends Cluster {
	public static clusterName = 'IlluminanceMeasurement';

	public abstract illuminance: DeviceAttribute<number>;
}

export abstract class DeviceColorControlCluster extends Cluster {
	public static clusterName = 'ColorControl';

	public abstract color: DeviceAttribute<Color>;
	public abstract setColor(args: {
		color: Color;
		overDurationMs?: number;
	}): Promise<void>;
}
