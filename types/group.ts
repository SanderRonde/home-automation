import type { IncludedIconNames } from '../app/client/dashboard/components/icon';

export type GroupId = string;

export interface DeviceGroup {
	id: GroupId;
	name: string;
	deviceIds: string[];
	icon?: IncludedIconNames;
	showOnHome?: boolean;
	color?: string;
	position?: { x: number; y: number };
}
