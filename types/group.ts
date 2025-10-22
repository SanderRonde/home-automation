export type GroupId = string;

export interface DeviceGroup {
	id: GroupId;
	name: string;
	deviceIds: string[];
}
