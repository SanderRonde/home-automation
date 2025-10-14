import type { DeviceClusterName } from '../app/server/modules/device/cluster';
import type * as Icons from '@mui/icons-material';

export type SceneId = string;

export interface SceneTrigger {
	type: 'occupancy';
	deviceId: string;
}

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

export type SceneDeviceAction = SceneDeviceActionOnOff | SceneDeviceActionWindowCovering;

export interface Scene {
	id: SceneId;
	title: string;
	icon: keyof typeof Icons;
	actions: SceneDeviceAction[];
	trigger?: SceneTrigger;
}
