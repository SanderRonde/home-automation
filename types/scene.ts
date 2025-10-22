import type { IncludedIconNames } from '../app/client/dashboard/components/icon';
import type { DeviceClusterName } from '../app/server/modules/device/cluster';

export type SceneId = string;

export type SceneTrigger =
	| {
			type: 'occupancy';
			deviceId: string;
	  }
	| {
			type: 'button-press';
			deviceId: string;
			buttonIndex: number;
	  };

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

export type SceneDeviceAction =
	| SceneDeviceActionOnOff
	| SceneDeviceActionWindowCovering
	| SceneDeviceActionLevelControl
	| SceneDeviceActionColorControl
	| SceneDeviceActionColorControlPalette;

export interface Scene {
	id: SceneId;
	title: string;
	icon: IncludedIconNames;
	actions: SceneDeviceAction[];
	trigger?: SceneTrigger;
}
