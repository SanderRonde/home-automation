import type { DeviceGroup, GroupId } from '../../../../types/group';
import type { Database } from '../../lib/db';
import type { DeviceDB } from '.';

export class GroupAPI {
	public constructor(private readonly _db: Database<DeviceDB>) {}

	public listGroups(): DeviceGroup[] {
		const groups = this._db.current().groups ?? {};
		return Object.values(groups);
	}

	public getGroup(id: GroupId): DeviceGroup | undefined {
		const groups = this._db.current().groups ?? {};
		return groups[id];
	}

	public createGroup(group: Omit<DeviceGroup, 'id'>): GroupId {
		// Validate unique name
		const existingGroups = this.listGroups();
		if (existingGroups.some((g) => g.name === group.name)) {
			throw new Error(`Group with name "${group.name}" already exists`);
		}

		const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const newGroup: DeviceGroup = {
			...group,
			id: groupId,
		};

		this._db.update((old) => ({
			...old,
			groups: {
				...(old.groups ?? {}),
				[groupId]: newGroup,
			},
		}));

		return groupId;
	}

	public updateGroup(id: GroupId, group: Omit<DeviceGroup, 'id'>): boolean {
		const groups = this._db.current().groups ?? {};
		if (!groups[id]) {
			return false;
		}

		// Validate unique name (excluding current group)
		const existingGroups = this.listGroups();
		if (existingGroups.some((g) => g.id !== id && g.name === group.name)) {
			throw new Error(`Group with name "${group.name}" already exists`);
		}

		this._db.update((old) => ({
			...old,
			groups: {
				...(old.groups ?? {}),
				[id]: {
					...group,
					id,
				},
			},
		}));

		return true;
	}

	public deleteGroup(id: GroupId): boolean {
		const groups = this._db.current().groups ?? {};
		if (!groups[id]) {
			return false;
		}

		const newGroups = { ...groups };
		delete newGroups[id];

		this._db.update((old) => ({
			...old,
			groups: newGroups,
		}));

		return true;
	}
}
