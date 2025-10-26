import type { IncludedIconNames } from '../app/client/dashboard/components/icon';
import type { DeviceClusterName } from '../app/server/modules/device/cluster';

export type SceneId = string;

export enum SceneTriggerType {
	OCCUPANCY = 'occupancy',
	BUTTON_PRESS = 'button-press',
	HOST_ARRIVAL = 'host-arrival',
	HOST_DEPARTURE = 'host-departure',
	WEBHOOK = 'webhook',
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
	  };

export enum SceneConditionType {
	HOST_HOME = 'host-home',
	DEVICE_ON = 'device-on',
}

export type SceneCondition =
	| {
			type: SceneConditionType.HOST_HOME;
			hostId: string;
			shouldBeHome: boolean;
	  }
	| {
			type: SceneConditionType.DEVICE_ON;
			deviceId: string;
			shouldBeOn: boolean;
	  };

export interface SceneTriggerWithConditions {
	trigger: SceneTrigger;
	conditions?: SceneCondition[];
}

export type SceneDeviceActionOnOff = {
	deviceId?: string;
	groupId?: string;
	cluster: DeviceClusterName.ON_OFF;
	action: {
		isOn: boolean;
	};
};

export type SceneDeviceActionWindowCovering = {
	deviceId?: string;
	groupId?: string;
	cluster: DeviceClusterName.WINDOW_COVERING;
	action: {
		targetPositionLiftPercentage: number;
	};
};

export type SceneDeviceActionLevelControl = {
	deviceId?: string;
	groupId?: string;
	cluster: DeviceClusterName.LEVEL_CONTROL;
	action: {
		level: number;
	};
};

export type SceneDeviceActionColorControl = {
	deviceId?: string;
	groupId?: string;
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

export type SceneDeviceAction =
	| SceneDeviceActionOnOff
	| SceneDeviceActionWindowCovering
	| SceneDeviceActionLevelControl
	| SceneDeviceActionColorControl
	| SceneDeviceActionColorControlPalette
	| SceneDeviceActionHttpRequest;

export interface Scene {
	id: SceneId;
	title: string;
	icon: IncludedIconNames;
	actions: SceneDeviceAction[];
	triggers?: SceneTriggerWithConditions[];
	showOnHome?: boolean;
}
