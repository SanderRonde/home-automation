/** Database schema for Nuki module (stored in database/nuki.json). */
export interface NukiDB {
	/** User's API token from web.nuki.io */
	apiToken?: string;
	/** Token expiration timestamp (if known) */
	tokenExpiry?: number;
	/** Registered webhook ID when using webhooks */
	webhookId?: number;
	/** Cached device info keyed by smartlock/opener ID */
	devices?: {
		[id: string]: {
			name: string;
			type: 'smartlock' | 'opener';
		};
	};
}

/** Nuki API lock state values. 0 = uncalibrated, 1 = locked, 2 = unlocked, 3 = unlocked (lock 'n' go), 4 = unlatched, 5 = locked (lock 'n' go), 6 = unlocked (relock), 255 = motor blocked */
export type NukiLockState = number;
export const NUKI_LOCK_STATE_LOCKED = 1;
export const NUKI_LOCK_STATE_UNLOCKED = 2;
export const NUKI_LOCK_STATE_UNLATCHED = 4;

/** Smartlock list item from GET /smartlock */
export interface NukiSmartlockListItem {
	smartlockId: number;
	accountId: number;
	name: string;
	type: number;
	state: NukiLockState;
	stateName: string;
	mode: number;
	modeName: string;
	model: string;
	firmwareVersion: string;
	hardwareVersion: string;
	config?: NukiSmartlockConfig;
}

/** Smartlock config (battery, etc.) */
export interface NukiSmartlockConfig {
	latitude?: number;
	longitude?: number;
	capabilities?: number;
	autoLock?: boolean;
	autoLockTimeout?: number;
	operatingMode?: number;
	nightModeEnabled?: boolean;
	batteryType?: string;
	batteryCritical?: boolean;
	batteryCharging?: boolean;
	batteryChargeState?: number;
	batteryCapacity?: number;
	batteryVoltage?: number;
	keypadBatteryCritical?: boolean;
}

/** Full smartlock details from GET /smartlock/{id} */
export interface NukiSmartlockDetails extends NukiSmartlockListItem {
	config: NukiSmartlockConfig;
}

/**
 * Legacy opener list shape (GET /opener does not exist in Web API).
 * Openers are returned by GET /smartlock?type=2; use NukiSmartlockListItem and smartlockId.
 */
export interface NukiOpenerListItem {
	openerId: number;
	accountId: number;
	name: string;
	type: number;
	state: number;
	stateName: string;
	mode: number;
	modeName: string;
	model: string;
	firmwareVersion: string;
	hardwareVersion: string;
}

/** Lock action for POST /smartlock/{id}/action */
export type NukiSmartlockAction = 1 | 2 | 3 | 4 | 5 | 6;
export const NUKI_ACTION_UNLOCK = 1;
export const NUKI_ACTION_LOCK = 2;
export const NUKI_ACTION_UNLATCH = 3;
export const NUKI_ACTION_LOCK_N_GO = 4;
export const NUKI_ACTION_LOCK_N_GO_WITH_UNLATCH = 5;
export const NUKI_ACTION_RELOCK = 6;

/** Opener action (sent via POST /smartlock/{id}/action; Web API has no separate opener action path). */
export type NukiOpenerAction = 1 | 2 | 3;
export const NUKI_OPENER_ACTION_ACTIVATE_RING = 1;
export const NUKI_OPENER_ACTION_DEACTIVATE_RING = 2;
export const NUKI_OPENER_ACTION_OPEN = 3;
