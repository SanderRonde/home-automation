import type { AirQuality, ConcentrationMeasurement } from '@matter/main/clusters';
import type { EventEmitter } from '../../lib/event-emitter';
import { type Actions } from '@matter/main/clusters';
import type { Color } from '../../lib/color';

import type { PrintState } from '../bambulab/types';
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
	public abstract getBaseCluster(): typeof Cluster & {
		clusterName: DeviceClusterName;
	};
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
	ACTIONS = 'Actions',
	AIR_QUALITY = 'AirQuality',
	CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT = 'CarbonDioxideConcentrationMeasurement',
	PM_2_5_CONCENTRATION_MEASUREMENT = 'Pm25ConcentrationMeasurement',
	THERMOSTAT = 'Thermostat',
	ELECTRICAL_ENERGY_MEASUREMENT = 'ElectricalEnergyMeasurement',
	ELECTRICAL_POWER_MEASUREMENT = 'ElectricalPowerMeasurement',
	WASHER = 'Washer',
	FRIDGE = 'Fridge',
	DOOR_LOCK = 'DoorLock',
	THREE_D_PRINTER = '3DPrinter',
}

/** Matter Door Lock cluster lock state (cluster 0x0101). */
export enum LockState {
	/** Lock state is not fully locked */
	NotFullyLocked = 0,
	/** Lock state is fully locked */
	Locked = 1,
	/** Lock state is fully unlocked */
	Unlocked = 2,
	/** Lock state is unlatched (door can be opened) */
	Unlatched = 3,
}

export abstract class DeviceDoorLockCluster extends Cluster {
	public static clusterName = DeviceClusterName.DOOR_LOCK;

	/** Current lock state */
	public abstract lockState: Data<LockState | undefined>;

	/** Lock the door */
	public abstract lockDoor(): Promise<void>;

	/** Unlock the door */
	public abstract unlockDoor(): Promise<void>;

	/** Toggle between locked and unlocked */
	public abstract toggle(): Promise<void>;

	/** Unlatch the door (for locks that support it). Optional in implementations. */
	public unlatchDoor?(): Promise<void>;
}

export abstract class DeviceOnOffCluster extends Cluster {
	public static clusterName = DeviceClusterName.ON_OFF;

	public abstract isOn: Data<boolean | undefined>;
	public abstract setOn(on: boolean): Promise<void>;
	public abstract toggle(): Promise<void>;
}

export abstract class DeviceWindowCoveringCluster extends Cluster {
	public static clusterName = DeviceClusterName.WINDOW_COVERING;

	// public abstract currentPositionLiftPercentage: Data<number>;
	/**
	 * A lift percentage of 0 means the cover is opened (to the top) and 100 means the cover is closed (to the bottom)
	 */
	public abstract targetPositionLiftPercentage: Data<number | undefined>;
	public abstract close(): Promise<void>;
	public abstract open(): Promise<void>;
	public abstract goToLiftPercentage(args: { percentage: number }): Promise<void>;
}

export abstract class DeviceLevelControlCluster extends Cluster {
	public static clusterName = DeviceClusterName.LEVEL_CONTROL;

	/**
	 * Used on the frontend to display the name of the cluster.
	 */
	public abstract name: Data<string>;

	/**
	 * Float from 0 to 1
	 */
	public abstract currentLevel: Data<number>;
	/**
	 * Float from 0 to 1
	 */
	public abstract startupLevel: Data<number>;
	/**
	 * Step size. Float from 0 to 1
	 */
	public abstract step: Data<number>;
	public abstract setLevel(args: { level: number; transitionTimeDs?: number }): Promise<void>;
	public abstract setStartupLevel(args: {
		level: number;
		transitionTimeDs?: number;
	}): Promise<void>;
	public abstract stop(): Promise<void>;
}

export abstract class DevicePowerSourceCluster extends Cluster {
	public static clusterName = DeviceClusterName.POWER_SOURCE;

	public abstract batteryChargeLevel: Data<number | undefined>;
}

export abstract class DeviceGroupsCluster extends Cluster {
	public static clusterName = DeviceClusterName.GROUPS;

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

	public abstract occupancy: Data<boolean | undefined>;

	public abstract onOccupied: EventEmitter<{ occupied: boolean }>;
}

export abstract class DeviceTemperatureMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.TEMPERATURE_MEASUREMENT;

	/**
	 * Temperature in degrees Celsius
	 */
	public abstract temperature: Data<number | undefined>;
}

export abstract class DeviceRelativeHumidityMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT;

	/**
	 * Relative humidity as a float from 0 to 1
	 */
	public abstract relativeHumidity: Data<number | undefined>;
}

export abstract class DeviceThreeDPrinterCluster extends Cluster {
	public static clusterName = DeviceClusterName.THREE_D_PRINTER;

	public abstract printState: Data<PrintState | undefined>;
	public abstract bedTemperature: Data<number | undefined>;
	public abstract nozzleTemperature: Data<number | undefined>;
	public abstract bedTargetTemperature: Data<number | undefined>;
	public abstract nozzleTargetTemperature: Data<number | undefined>;
	public abstract currentLayer: Data<number | undefined>;
	public abstract totalLayers: Data<number | undefined>;
	public abstract remainingTimeMinutes: Data<number | undefined>;
	/** Progress as a float */
	public abstract progress: Data<number | undefined>;
	public abstract currentFile: Data<string | undefined>;
	public abstract usedTray: Data<number | undefined>;
	public abstract ams: Data<
		| {
				/** Temperature in Celsius */
				temp: number;
				/** Humidity as a float */
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
}

export abstract class DeviceBooleanStateCluster<S extends boolean> extends Cluster {
	public static clusterName = DeviceClusterName.BOOLEAN_STATE;

	public abstract state: Data<S>;
	public abstract onStateChange: EventEmitter<{ state: S }>;
}

export abstract class DeviceSwitchCluster extends Cluster {
	public static clusterName = DeviceClusterName.SWITCH;

	public abstract getTotalCount(): number;
	public abstract getIndex(): number;
	public abstract getLabel(): string;

	public abstract onPress: EventEmitter<void>;
}

export abstract class DeviceSwitchWithLongPressCluster extends DeviceSwitchCluster {
	public abstract onLongPress: EventEmitter<void>;
	public abstract getClusterVariant(): 'longPress';
}

export abstract class DeviceSwitchWithMultiPressCluster extends DeviceSwitchCluster {
	public abstract onMultiPress: EventEmitter<{ pressCount: number }>;
	public abstract getClusterVariant(): 'multiPress';
}

export abstract class DeviceSwitchWithLongPressAndMultiPressCluster extends DeviceSwitchCluster {
	public abstract onLongPress: EventEmitter<void>;
	public abstract onMultiPress: EventEmitter<{ pressCount: number }>;
	public abstract getClusterVariant(): 'longPressAndMultiPress';
}

export abstract class DeviceIlluminanceMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.ILLUMINANCE_MEASUREMENT;

	public abstract illuminance: Data<number>;
}

export abstract class DeviceColorControlTemperatureCluster extends Cluster {
	public static clusterName = DeviceClusterName.COLOR_CONTROL;
	public abstract getClusterVariant(): 'temperature';

	/** In Kelvin */
	public abstract colorTemperature: Data<number | undefined>;
	/** In Kelvin */
	public abstract colorTemperatureMin: Data<number | undefined>;
	/** In Kelvin */
	public abstract colorTemperatureMax: Data<number | undefined>;
	public abstract setColorTemperature(args: {
		/** In Kelvin */
		colorTemperature: number;
	}): Promise<void>;
}

export abstract class DeviceColorControlXYCluster extends Cluster {
	public static clusterName = DeviceClusterName.COLOR_CONTROL;
	public abstract getClusterVariant(): 'xy';

	public abstract color: Data<Color | undefined>;
	public abstract setColor(args: { colors: Color[]; overDurationMs?: number }): Promise<void>;
	public abstract getSegmentCount(): number;
}

export interface DeviceAction {
	id: number;
	name: string;
	type: Actions.ActionType;
	state: Actions.ActionState;
}

export abstract class DeviceActionsCluster extends Cluster {
	public static clusterName = DeviceClusterName.ACTIONS;

	public abstract actionList: Data<DeviceAction[]>;
	public abstract executeAction(args: { actionId: number }): Promise<void>;
}

export abstract class DeviceAirQualityCluster extends Cluster {
	public static clusterName = DeviceClusterName.AIR_QUALITY;

	public abstract airQuality: Data<AirQuality.AirQualityEnum | undefined>;
}

export abstract class DeviceCarbonDioxideConcentrationMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT;
}

export abstract class DeviceCarbonDioxideConcentrationMeasurementWithNumericAndLevelIndicationCluster extends DeviceCarbonDioxideConcentrationMeasurementCluster {
	public abstract getClusterVariant(): 'numeric+levelIndication';

	/** In parts per million */
	public abstract concentration: Data<number | undefined>;

	public abstract level: Data<ConcentrationMeasurement.LevelValue>;
}

export abstract class DevicePm25ConcentrationMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT;
}

export abstract class DevicePm25ConcentrationMeasurementWithNumericAndLevelIndicationCluster extends DevicePm25ConcentrationMeasurementCluster {
	public abstract getClusterVariant(): 'numeric+levelIndication';

	/** In parts per million */
	public abstract concentration: Data<number | undefined>;

	public abstract level: Data<ConcentrationMeasurement.LevelValue>;
}

export enum ThermostatMode {
	OFF = 'off',
	HEAT = 'heat',
	COOL = 'cool',
	AUTO = 'auto',
	MANUAL = 'manual',
}

export abstract class DeviceThermostatCluster extends Cluster {
	public static clusterName = DeviceClusterName.THERMOSTAT;

	/**
	 * Current temperature in degrees Celsius
	 */
	public abstract currentTemperature: Data<number | undefined>;
	/**
	 * Target temperature in degrees Celsius
	 */
	public abstract targetTemperature: Data<number | undefined>;
	/**
	 * Current thermostat mode
	 */
	public abstract mode: Data<ThermostatMode | undefined>;
	/**
	 * Whether the thermostat is currently heating or cooling
	 */
	public abstract isHeating: Data<boolean | undefined>;

	public abstract setTargetTemperature(temperature: number): Promise<void>;
	public abstract setMode(mode: ThermostatMode): Promise<void>;
}

export abstract class DeviceElectricalEnergyMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT;

	/** In Watt-hours */
	public abstract totalEnergy: Data<bigint>;
	public abstract totalEnergyPeriod: Data<{ from: Date; to: Date } | undefined>;
}

export abstract class DeviceElectricalPowerMeasurementCluster extends Cluster {
	public static clusterName = DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT;

	public abstract activePower: Data<number | undefined>; // in Watts
}

export abstract class DeviceWasherCluster extends Cluster {
	public static clusterName = DeviceClusterName.WASHER;

	/** "stop" | "run" | "pause" */
	public abstract machineState: Data<'stop' | 'run' | 'pause' | undefined>;
	/** "ready" | "running" | "paused" (Samsung) */
	public abstract operatingState: Data<'ready' | 'running' | 'paused' | undefined>;
	/** "none" or job name (Samsung) */
	public abstract washerJobState: Data<'none' | string | undefined>;
	/** Is the cycle done (idle, no job). */
	public abstract done: Data<boolean | undefined>;
	/** When the current/last run is scheduled to finish (ISO string). */
	public abstract completionTime: Data<string | undefined>;
	/** Remaining time in minutes (when running). */
	public abstract remainingTimeMinutes: Data<number | undefined>;
	/** Remaining time string e.g. "02:36". */
	public abstract remainingTimeStr: Data<string | undefined>;
	/** Detergent remaining (cc). */
	public abstract detergentRemainingCc: Data<number | undefined>;
	/** Detergent initial capacity (cc). */
	public abstract detergentInitialCc: Data<number | undefined>;
	/** Softener remaining (cc). */
	public abstract softenerRemainingCc: Data<number | undefined>;
	/** Softener initial capacity (cc). */
	public abstract softenerInitialCc: Data<number | undefined>;
	/** Current cycle/course e.g. "Table_02_Course_1C". */
	public abstract cycle: Data<string | undefined>;
	/** Cycle type e.g. "washingOnly". */
	public abstract cycleType: Data<'washingOnly' | undefined>;
	/** Phase: "wash" | "rinse" | "spin" | "none". */
	public abstract phase: Data<'wash' | 'rinse' | 'spin' | 'none' | undefined>;
	/** Progress 0–100 (%). */
	public abstract progressPercent: Data<number | undefined>;
	/** Scheduled phases with names and durations (min). */
	public abstract scheduledPhases: Data<
		Array<{ phaseName: string; timeInMin: number }> | undefined
	>;
}

export abstract class DeviceFridgeCluster extends Cluster {
	public static clusterName = DeviceClusterName.FRIDGE;

	/** Freezer door open. */
	public abstract freezerDoorOpen: Data<boolean | undefined>;
	/** Fridge (cooler) door open. */
	public abstract coolerDoorOpen: Data<boolean | undefined>;
	/** Fridge (cooler) current temp °C. */
	public abstract fridgeTempC: Data<number | undefined>;
	/** Freezer current temp °C. */
	public abstract freezerTempC: Data<number | undefined>;
}
