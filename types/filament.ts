/**
 * Filament spool: stored fields are maxWeight and percentage.
 * currentWeight is derived as (percentage / 100) * maxWeight when serializing.
 */
export interface FilamentSpool {
	id: string;
	color: string;
	type: FilamentType;
	specialProperties?: string;
	maxWeight: number;
	percentage: number;
	/** Derived: (percentage / 100) * maxWeight. Do not store; compute when reading. */
	currentWeight: number;
	createdAt: number;
	updatedAt: number;
}

export const FILAMENT_TYPES = ['PLA', 'PETG', 'ABS', 'TPU', 'NYLON', 'ASA', 'OTHER'] as const;

export type FilamentType = (typeof FILAMENT_TYPES)[number];

export interface AMSSlotAssignment {
	deviceId: string;
	slotIndex: number;
	filamentId: string | null;
	assignedAt: number;
}

export type FilamentChangeAction = 'loaded' | 'unloaded' | 'percentage_updated';

export interface FilamentChangeEvent {
	id: string;
	timestamp: number;
	deviceId: string;
	slotIndex: number;
	action: FilamentChangeAction;
	filamentId: string | null;
	oldPercentage?: number;
	newPercentage?: number;
}

/** Stored in JSON DB: no currentWeight. */
export type FilamentSpoolStored = Omit<FilamentSpool, 'currentWeight'>;
