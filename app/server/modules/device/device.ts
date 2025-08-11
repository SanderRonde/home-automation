/**
 * Largely borrows from Matter in shape/choices
 * but not (yet?) in implementation.
 */

// Roughly translates to a Matter endpoint
export interface Device {
	getUniqueId(): string;
	clusters: Cluster[];
}

export type DeviceAttribute<T> = {
	value: Promise<T>;
	listen(handler: (value: T) => void): () => void;
};

export abstract class Cluster {}

export abstract class OnOffDevice extends Cluster {
	public static get clusterName(): string {
		return 'OnOff';
	}

	public abstract isOn: DeviceAttribute<boolean>;

	public abstract setOn(on: boolean): Promise<void>;

	public abstract toggle(): Promise<void>;
}

export abstract class WindowCoveringDevice extends Cluster {
	public static get clusterName(): string {
		return 'WindowCovering';
	}

	public abstract currentPositionLiftPercentage: DeviceAttribute<number>;

	public abstract targetPositionLiftPercentage: DeviceAttribute<number>;

	public abstract close(): Promise<void>;

	public abstract open(): Promise<void>;

	public abstract goToLiftPercentage(args: {
		percentage: number;
	}): Promise<void>;
}

export abstract class LevelControlDevice extends Cluster {
	public static get clusterName(): string {
		return 'LevelControl';
	}

	public abstract currentLevel: DeviceAttribute<number>;
}

export abstract class PowerSourceDevice extends Cluster {
	public static get clusterName(): string {
		return 'PowerSource';
	}

	public abstract batteryChargeLevel: DeviceAttribute<number>;
}

export abstract class GroupsDevice extends Cluster {
	public static get clusterName(): string {
		return 'Groups';
	}

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

export abstract class OccupancySensingDevice extends Cluster {
	public static get clusterName(): string {
		return 'OccupancySensing';
	}

	public abstract occupancy: DeviceAttribute<boolean>;
}

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
