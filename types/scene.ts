import type { DeviceClusterName } from '../app/server/modules/device/cluster';
import type * as Icons from '@mui/icons-material';

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
	deviceId: string;
	cluster: DeviceClusterName.ON_OFF;
	action: {
		isOn: boolean;
	};
};

export type SceneDeviceActionWindowCovering = {
	deviceId: string;
	cluster: DeviceClusterName.WINDOW_COVERING;
	action: {
		targetPositionLiftPercentage: number;
	};
};

export type SceneDeviceActionLevelControl = {
	deviceId: string;
	cluster: DeviceClusterName.LEVEL_CONTROL;
	action: {
		level: number;
	};
};

export type SceneDeviceActionColorControl = {
	deviceId: string;
	cluster: DeviceClusterName.COLOR_CONTROL;
	action: {
		hue: number;
		saturation: number;
		value: number;
	};
};

export type SceneDeviceAction =
	| SceneDeviceActionOnOff
	| SceneDeviceActionWindowCovering
	| SceneDeviceActionLevelControl
	| SceneDeviceActionColorControl;

export interface Scene {
	id: SceneId;
	title: string;
	icon: keyof typeof Icons;
	actions: SceneDeviceAction[];
	trigger?: SceneTrigger;
}
