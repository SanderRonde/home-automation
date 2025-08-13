import type { EventEmitter } from '../../lib/event-emitter';
import type { DeviceAttribute } from './device';

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

export interface Cluster {}

export interface DeviceOnOffCluster extends Cluster {
	isOn: DeviceAttribute<boolean>;
	setOn(on: boolean): Promise<void>;
	toggle(): Promise<void>;
}

export interface DeviceWindowCoveringCluster extends Cluster {
	currentPositionLiftPercentage: DeviceAttribute<number>;
	targetPositionLiftPercentage: DeviceAttribute<number>;
	close(): Promise<void>;
	open(): Promise<void>;
	goToLiftPercentage(args: { percentage: number }): Promise<void>;
}

export interface DeviceLevelControlCluster extends Cluster {
	/**
	 * Float from 0 to 1
	 */
	currentLevel: DeviceAttribute<number>;
	/**
	 * Float from 0 to 1
	 */
	startupLevel: DeviceAttribute<number>;
	setLevel(args: { level: number; transitionTimeDs?: number }): Promise<void>;
	setStartupLevel(args: {
		level: number;
		transitionTimeDs?: number;
	}): Promise<void>;
	stop(): Promise<void>;
}

export interface DevicePowerSourceCluster extends Cluster {
	batteryChargeLevel: DeviceAttribute<number | null>;
}

export interface DeviceGroupsCluster extends Cluster {
	addGroup(args: { groupId: number; groupName: string }): Promise<{
		status: DeviceStatus;
		groupId: DeviceGroupId;
	}>;
	listGroupMemberships(): Promise<{
		groupList: DeviceGroupId[];
	}>;
	getFilteredGroupMembership(args: { groupList: DeviceGroupId[] }): Promise<{
		groupList: DeviceGroupId[];
	}>;
	removeGroup(args: { groupId: DeviceGroupId }): Promise<{
		status: DeviceStatus;
		groupId: DeviceGroupId;
	}>;
}

export interface DeviceOccupancySensingCluster extends Cluster {
	occupancy: DeviceAttribute<boolean>;
}

export interface DeviceTemperatureMeasurementCluster extends Cluster {
	/**
	 * Temperature in degrees Celsius
	 */
	temperature: DeviceAttribute<number>;
}

export interface DeviceRelativeHumidityMeasurementCluster extends Cluster {
	/**
	 * Relative humidity as a float from 0 to 1
	 */
	relativeHumidity: DeviceAttribute<number>;
}

export interface DeviceBooleanStateCluster<S extends boolean> extends Cluster {
	state: DeviceAttribute<S>;
}

export interface DeviceSwitchCluster extends Cluster {
	onPress: EventEmitter<void>;
	onDoublePress: EventEmitter<void>;
}

export interface DeviceIlluminanceMeasurementCluster extends Cluster {
	illuminance: DeviceAttribute<number>;
}
