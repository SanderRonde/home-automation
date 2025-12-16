import type { DeviceGroup, GroupId } from '../../../../types/group';
import type { Database } from '../../lib/db';
import type { DeviceDB } from '.';

export class GroupAPI {
	public constructor(private readonly _db: Database<DeviceDB>) {}

	private generatePastelColor(name: string): string {
		// Predefined color palette for distinct group colors
		const colorPalette = [
			'#8FB5D6', // Light blue
			'#7DD4A8', // Mint green
			'#A4CD76', // Light green
			'#8B9FDE', // Periwinkle blue
			'#73D1B8', // Turquoise
			'#E8B563', // Golden yellow
			'#D4A5A5', // Dusty rose
			'#B298DC', // Lavender
			'#6ECEB2', // Seafoam
			'#A8D08D', // Sage green
			'#F4A261', // Sandy orange
			'#E07A5F', // Terra cotta
		];

		// Simple hash function to pick from palette
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}

		const index = Math.abs(hash) % colorPalette.length;
		return colorPalette[index];
	}

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
			color: group.color || this.generatePastelColor(group.name),
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

		const existingGroup = groups[id];
		this._db.update((old) => ({
			...old,
			groups: {
				...(old.groups ?? {}),
				[id]: {
					...group,
					id,
					// Preserve existing color or generate new one if name changed
					color:
						group.color || existingGroup.color || this.generatePastelColor(group.name),
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

	public updateGroupPosition(id: GroupId, position: { x: number; y: number } | null): boolean {
		const groups = this._db.current().groups ?? {};
		if (!groups[id]) {
			return false;
		}

		const updatedGroup = { ...groups[id] };
		if (position === null) {
			delete updatedGroup.position;
		} else {
			updatedGroup.position = position;
		}

		this._db.update((old) => ({
			...old,
			groups: {
				...(old.groups ?? {}),
				[id]: updatedGroup,
			},
		}));

		return true;
	}
}
