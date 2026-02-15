import type {
	FilamentSpool,
	FilamentSpoolStored,
	AMSSlotAssignment,
	FilamentChangeEvent,
	FilamentChangeAction,
} from '../../../../types/filament';
import { FILAMENT_TYPES } from '../../../../types/filament';
import type { Database } from '../../lib/db';
import type { FilamentDB } from './index';
import type { SQL } from 'bun';

function getCurrentWeight(percentage: number, maxWeight: number): number {
	return Math.round((percentage / 100) * maxWeight);
}

function calculatePercentage(currentWeight: number, maxWeight: number): number {
	if (maxWeight <= 0) {
		return 0;
	}
	return Math.round((currentWeight / maxWeight) * 100 * 10) / 10;
}

function toSpool(stored: FilamentSpoolStored): FilamentSpool {
	return {
		...stored,
		currentWeight: getCurrentWeight(stored.percentage, stored.maxWeight),
	};
}

function assignmentKey(deviceId: string, slotIndex: number): string {
	return `${deviceId}_${slotIndex}`;
}

export type CreateSpoolInput = {
	color: string;
	type: FilamentSpool['type'];
	specialProperties?: string;
	maxWeight: number;
	/** Either percentage (0-100) or currentWeight; percentage takes precedence if both set. */
	percentage?: number;
	currentWeight?: number;
};

export type UpdateSpoolInput = Partial<
	Pick<FilamentSpoolStored, 'color' | 'type' | 'specialProperties' | 'maxWeight' | 'percentage'>
> & {
	currentWeight?: number;
};

export class FilamentAPI {
	public constructor(
		private readonly _db: Database<FilamentDB>,
		private readonly _sqlDB: SQL
	) {}

	public listSpools(): FilamentSpool[] {
		const spools = this._db.current().spools ?? {};
		return Object.values(spools).map(toSpool);
	}

	public getSpool(id: string): FilamentSpool | undefined {
		const spools = this._db.current().spools ?? {};
		const stored = spools[id];
		return stored ? toSpool(stored) : undefined;
	}

	public createSpool(data: CreateSpoolInput): string {
		const now = Date.now();
		let percentage: number;
		if (data.percentage !== undefined && data.percentage !== null) {
			percentage = Math.min(100, Math.max(0, data.percentage));
		} else if (
			data.currentWeight !== undefined &&
			data.currentWeight !== null &&
			data.maxWeight > 0
		) {
			percentage = calculatePercentage(data.currentWeight, data.maxWeight);
		} else {
			percentage = 100;
		}
		const id = `spool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const stored: FilamentSpoolStored = {
			id,
			color: data.color,
			type: data.type,
			specialProperties: data.specialProperties,
			maxWeight: data.maxWeight,
			percentage,
			createdAt: now,
			updatedAt: now,
		};
		this._db.update((old) => ({
			...old,
			spools: {
				...(old.spools ?? {}),
				[id]: stored,
			},
		}));
		return id;
	}

	public updateSpool(id: string, data: UpdateSpoolInput): boolean {
		const spools = this._db.current().spools ?? {};
		const existing = spools[id];
		if (!existing) {
			return false;
		}

		let percentage = existing.percentage;
		let maxWeight = existing.maxWeight;
		if (data.percentage !== undefined && data.percentage !== null) {
			percentage = Math.min(100, Math.max(0, data.percentage));
		} else if (
			data.currentWeight !== undefined &&
			data.currentWeight !== null &&
			(data.maxWeight ?? existing.maxWeight) > 0
		) {
			maxWeight = data.maxWeight ?? existing.maxWeight;
			percentage = calculatePercentage(data.currentWeight, maxWeight);
		}
		if (data.maxWeight !== undefined) {
			maxWeight = data.maxWeight;
		}

		const updated: FilamentSpoolStored = {
			...existing,
			...(data.color !== undefined && { color: data.color }),
			...(data.type !== undefined && { type: data.type }),
			...(data.specialProperties !== undefined && {
				specialProperties: data.specialProperties,
			}),
			maxWeight,
			percentage,
			updatedAt: Date.now(),
		};
		this._db.update((old) => ({
			...old,
			spools: {
				...(old.spools ?? {}),
				[id]: updated,
			},
		}));
		return true;
	}

	public deleteSpool(id: string): boolean {
		const spools = this._db.current().spools ?? {};
		if (!spools[id]) {
			return false;
		}
		const assignments = this._db.current().assignments ?? {};
		const nextAssignments = { ...assignments };
		for (const key of Object.keys(nextAssignments)) {
			if (nextAssignments[key]?.filamentId === id) {
				nextAssignments[key] = {
					...nextAssignments[key]!,
					filamentId: null,
					assignedAt: Date.now(),
				};
			}
		}
		const newSpools = { ...spools };
		delete newSpools[id];
		this._db.update((old) => ({
			...old,
			spools: newSpools,
			assignments: nextAssignments,
		}));
		return true;
	}

	public getAssignments(deviceId?: string): AMSSlotAssignment[] {
		const assignments = this._db.current().assignments ?? {};
		const list = Object.values(assignments);
		if (deviceId !== undefined) {
			return list.filter((a) => a.deviceId === deviceId);
		}
		return list;
	}

	public getAssignment(deviceId: string, slotIndex: number): AMSSlotAssignment | undefined {
		const assignments = this._db.current().assignments ?? {};
		return assignments[assignmentKey(deviceId, slotIndex)];
	}

	public assignFilament(deviceId: string, slotIndex: number, filamentId: string): boolean {
		const spools = this._db.current().spools ?? {};
		if (!spools[filamentId]) {
			return false;
		}
		const key = assignmentKey(deviceId, slotIndex);
		const now = Date.now();
		const assignments = this._db.current().assignments ?? {};
		const prev = assignments[key];
		this._db.update((old) => ({
			...old,
			assignments: {
				...(old.assignments ?? {}),
				[key]: {
					deviceId,
					slotIndex,
					filamentId,
					assignedAt: now,
				},
			},
		}));
		void this._recordHistory({
			timestamp: now,
			deviceId,
			slotIndex,
			action: 'loaded',
			filamentId,
		});
		if (prev?.filamentId && prev.filamentId !== filamentId) {
			void this._recordHistory({
				timestamp: now,
				deviceId,
				slotIndex,
				action: 'unloaded',
				filamentId: prev.filamentId,
			});
		}
		return true;
	}

	public unassignFilament(deviceId: string, slotIndex: number): boolean {
		const key = assignmentKey(deviceId, slotIndex);
		const assignments = this._db.current().assignments ?? {};
		const prev = assignments[key];
		if (!prev?.filamentId) {
			return true;
		}
		const now = Date.now();
		this._db.update((old) => ({
			...old,
			assignments: {
				...(old.assignments ?? {}),
				[key]: {
					deviceId,
					slotIndex,
					filamentId: null,
					assignedAt: now,
				},
			},
		}));
		void this._recordHistory({
			timestamp: now,
			deviceId,
			slotIndex,
			action: 'unloaded',
			filamentId: prev.filamentId,
		});
		return true;
	}

	public updateFilamentPercentage(filamentId: string, percentage: number): boolean {
		const spools = this._db.current().spools ?? {};
		const spool = spools[filamentId];
		if (!spool) {
			return false;
		}
		const clamped = Math.min(100, Math.max(0, percentage));
		if (Math.abs(spool.percentage - clamped) < 0.01) {
			return true;
		}
		const oldPercentage = spool.percentage;
		this._db.update((old) => {
			const current = old.spools ?? {};
			const s = current[filamentId];
			if (!s) {
				return old;
			}
			return {
				...old,
				spools: {
					...current,
					[filamentId]: {
						...s,
						percentage: clamped,
						updatedAt: Date.now(),
					},
				},
			};
		});
		const assignment = this._getAssignmentByFilamentId(filamentId);
		if (assignment) {
			void this._recordHistory({
				timestamp: Date.now(),
				deviceId: assignment.deviceId,
				slotIndex: assignment.slotIndex,
				action: 'percentage_updated',
				filamentId,
				oldPercentage,
				newPercentage: clamped,
			});
		}
		return true;
	}

	private _getAssignmentByFilamentId(filamentId: string): AMSSlotAssignment | undefined {
		const assignments = this._db.current().assignments ?? {};
		return Object.values(assignments).find((a) => a.filamentId === filamentId);
	}

	public async getFilamentHistory(
		filamentId?: string,
		limit = 100
	): Promise<FilamentChangeEvent[]> {
		type HistoryRow = {
			id: string;
			timestamp: number;
			device_id: string;
			slot_index: number;
			action: string;
			filament_id: string | null;
			old_percentage: number | null;
			new_percentage: number | null;
		};
		if (filamentId) {
			const rows = (await this._sqlDB`
				SELECT * FROM filament_history
				WHERE filament_id = ${filamentId}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`) as HistoryRow[];
			const list = Array.isArray(rows) ? rows : [rows];
			return list.map((r: HistoryRow) => ({
				id: String(r.id),
				timestamp: r.timestamp,
				deviceId: r.device_id,
				slotIndex: r.slot_index,
				action: r.action as FilamentChangeAction,
				filamentId: r.filament_id,
				oldPercentage: r.old_percentage ?? undefined,
				newPercentage: r.new_percentage ?? undefined,
			}));
		}
		const rowsAll = (await this._sqlDB`
			SELECT * FROM filament_history
			ORDER BY timestamp DESC
			LIMIT ${limit}
		`) as HistoryRow[];
		const listAll = Array.isArray(rowsAll) ? rowsAll : [rowsAll];
		return listAll.map((r: HistoryRow) => ({
			id: String(r.id),
			timestamp: r.timestamp,
			deviceId: r.device_id,
			slotIndex: r.slot_index,
			action: r.action as FilamentChangeAction,
			filamentId: r.filament_id,
			oldPercentage: r.old_percentage ?? undefined,
			newPercentage: r.new_percentage ?? undefined,
		}));
	}

	private async _recordHistory(event: {
		timestamp: number;
		deviceId: string;
		slotIndex: number;
		action: FilamentChangeAction;
		filamentId: string | null;
		oldPercentage?: number;
		newPercentage?: number;
	}): Promise<void> {
		await this._sqlDB`
			INSERT INTO filament_history (
				timestamp, device_id, slot_index, action, filament_id,
				old_percentage, new_percentage
			) VALUES (
				${event.timestamp}, ${event.deviceId}, ${event.slotIndex}, ${event.action},
				${event.filamentId}, ${event.oldPercentage ?? null}, ${event.newPercentage ?? null}
			)
		`;
	}
}

export { FILAMENT_TYPES };
