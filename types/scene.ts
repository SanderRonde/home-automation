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
}

export type SceneTrigger =
	| {
			type: SceneTriggerType.OCCUPANCY;
			deviceId: string;
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
	  };

export enum SceneConditionType {
	HOST_HOME = 'host-home',
	DEVICE_ON = 'device-on',
	TIME_WINDOW = 'time-window',
	ANYONE_HOME = 'anyone-home',
	CUSTOM_JS = 'custom-js',
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

export type SceneDeviceAction =
	| SceneDeviceActionOnOff
	| SceneDeviceActionWindowCovering
	| SceneDeviceActionLevelControl
	| SceneDeviceActionColorControl
	| SceneDeviceActionColorControlPalette
	| SceneDeviceActionHttpRequest
	| SceneDeviceActionNotification;

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
