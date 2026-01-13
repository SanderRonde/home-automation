import type { IncludedIconNames } from '../app/client/dashboard/components/icon';
import type { DeviceClusterName } from '../app/server/modules/device/cluster';

export type SceneId = string;

export enum SceneTriggerType {
	OCCUPANCY = 'occupancy',
	BUTTON_PRESS = 'button-press',
	HOST_ARRIVAL = 'host-arrival',
	HOST_DEPARTURE = 'host-departure',
	WEBHOOK = 'webhook',
	ANYBODY_HOME = 'anybody-home',
	NOBODY_HOME = 'nobody-home',
	NOBODY_HOME_TIMEOUT = 'nobody-home-timeout',
	CRON = 'cron',
	LOCATION_WITHIN_RANGE = 'location-within-range',
}

export type SceneTrigger =
	| {
			type: SceneTriggerType.OCCUPANCY;
			deviceId: string;
			occupied: boolean; // true = trigger on occupancy detected, false = trigger on occupancy removed
	  }
	| {
			type: SceneTriggerType.BUTTON_PRESS;
			deviceId: string;
			buttonIndex: number;
	  }
	| {
			type: SceneTriggerType.HOST_ARRIVAL;
			hostId: string;
	  }
	| {
			type: SceneTriggerType.HOST_DEPARTURE;
			hostId: string;
	  }
	| {
			type: SceneTriggerType.WEBHOOK;
			webhookName: string;
	  }
	| {
			type: SceneTriggerType.ANYBODY_HOME;
	  }
	| {
			type: SceneTriggerType.NOBODY_HOME;
	  }
	| {
			type: SceneTriggerType.NOBODY_HOME_TIMEOUT;
	  }
	| {
			type: SceneTriggerType.CRON;
			intervalMinutes: number; // Run every X minutes
	  }
	| {
			type: SceneTriggerType.LOCATION_WITHIN_RANGE;
			deviceId: string; // Device to track (e.g., "my-phone")
			targetId: string; // Target to check distance from (e.g., "home")
			rangeKm: number;
			enteredRange: boolean;
	  };

export enum SceneConditionType {
	HOST_HOME = 'host-home',
	DEVICE_ON = 'device-on',
	TIME_WINDOW = 'time-window',
	ANYONE_HOME = 'anyone-home',
	CUSTOM_JS = 'custom-js',
	VARIABLE = 'variable',
	DELAY = 'delay',
}

export type TimeWindow = {
	start: string; // HH:MM format
	end: string; // HH:MM format
};

export type SceneCondition =
	| {
			type: SceneConditionType.HOST_HOME;
			hostId: string;
			shouldBeHome: boolean;
			checkOnManual?: boolean; // Default false - whether to check this condition on manual trigger
	  }
	| {
			type: SceneConditionType.DEVICE_ON;
			deviceId: string;
			shouldBeOn: boolean;
			checkOnManual?: boolean; // Default false - whether to check this condition on manual trigger
	  }
	| {
			type: SceneConditionType.TIME_WINDOW;
			windows: {
				monday?: TimeWindow;
				tuesday?: TimeWindow;
				wednesday?: TimeWindow;
				thursday?: TimeWindow;
				friday?: TimeWindow;
				saturday?: TimeWindow;
				sunday?: TimeWindow;
			};
			checkOnManual?: boolean; // Default false - whether to check this condition on manual trigger
	  }
	| {
			type: SceneConditionType.ANYONE_HOME;
			shouldBeHome: boolean;
			checkOnManual?: boolean; // Default false - whether to check this condition on manual trigger
	  }
	| {
			type: SceneConditionType.CUSTOM_JS;
			code: string;
			checkOnManual?: boolean; // Default false - whether to check this condition on manual trigger
	  }
	| {
			type: SceneConditionType.VARIABLE;
			variableName: string;
			shouldBeTrue: boolean; // true = check if variable is true, false = check if variable is false
			invert?: boolean; // Optional: invert the condition
			checkOnManual?: boolean; // Default false - whether to check this condition on manual trigger
	  }
	| {
			type: SceneConditionType.DELAY;
			seconds: number; // Wait time in seconds
			checkOnManual?: boolean; // Default false - whether to check this condition on manual trigger
	  };

export interface SceneTriggerWithConditions {
	trigger: SceneTrigger;
	conditions?: SceneCondition[];
}

export type SceneDeviceActionOnOff = {
	deviceId?: string;
	groupId?: string;
	excludeDeviceIds?: string[];
	cluster: DeviceClusterName.ON_OFF;
	action: {
		isOn: boolean;
	};
};

export type SceneDeviceActionWindowCovering = {
	deviceId?: string;
	groupId?: string;
	excludeDeviceIds?: string[];
	cluster: DeviceClusterName.WINDOW_COVERING;
	action: {
		targetPositionLiftPercentage: number;
	};
};

export type SceneDeviceActionLevelControl = {
	deviceId?: string;
	groupId?: string;
	excludeDeviceIds?: string[];
	cluster: DeviceClusterName.LEVEL_CONTROL;
	action: {
		level: number;
		durationSeconds?: number; // Optional: gradually increase level over this duration
	};
};

export type SceneDeviceActionColorControl = {
	deviceId?: string;
	groupId?: string;
	excludeDeviceIds?: string[];
	cluster: DeviceClusterName.COLOR_CONTROL;
	action: {
		hue: number;
		saturation: number;
		value: number;
	};
};

export type SceneDeviceActionColorControlPalette = {
	deviceId?: string;
	groupId?: string;
	excludeDeviceIds?: string[];
	cluster: DeviceClusterName.COLOR_CONTROL;
	action: {
		paletteId: string;
	};
};

export type SceneDeviceActionHttpRequest = {
	cluster: 'http-request';
	action: {
		url: string;
		method: 'GET' | 'POST';
		body?: Record<string, unknown>;
		headers?: Record<string, string>;
	};
};

export type SceneDeviceActionNotification = {
	cluster: 'notification';
	action: {
		title: string;
		body: string;
	};
};

export type SceneDeviceActionRoomTemperature = {
	cluster: 'room-temperature';
	action: {
		roomName?: string; // Optional for activateState mode
		mode: 'setTarget' | 'returnToSchedule' | 'activateState';
		targetTemperature?: number; // Required for setTarget mode
		stateId?: string; // Required for activateState mode
	};
};

export type SceneDeviceActionSetVariable = {
	cluster: 'set-variable';
	action: {
		variableName: string;
		value: boolean;
	};
};

export type SceneDeviceAction =
	| SceneDeviceActionOnOff
	| SceneDeviceActionWindowCovering
	| SceneDeviceActionLevelControl
	| SceneDeviceActionColorControl
	| SceneDeviceActionColorControlPalette
	| SceneDeviceActionHttpRequest
	| SceneDeviceActionNotification
	| SceneDeviceActionRoomTemperature
	| SceneDeviceActionSetVariable;

export interface Scene {
	id: SceneId;
	title: string;
	icon: IncludedIconNames;
	actions: SceneDeviceAction[];
	triggers?: SceneTriggerWithConditions[];
	showOnHome?: boolean;
}

export interface SceneExecution {
	id: number;
	scene_id: SceneId;
	scene_title: string;
	timestamp: number;
	trigger_type: 'manual' | SceneTriggerType;
	trigger_source?: string | null;
	success: boolean;
}
