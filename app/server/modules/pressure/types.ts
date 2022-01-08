import { PossiblePromise } from '../../lib/types';
import { ModuleHookables } from '..';

export const enum PRESSURE_CHANGE_DIRECTION {
	UP,
	DOWN,
}

export const enum PRESSURE_REGISTER {
	REGISTER_CHANGED,
	IGNORE_CHANGE,
}

export interface PressureRange {
	type: 'range';
	/**
	 * A starting range, minimum value is 0.
	 * Set to 0 if omitted
	 */
	from?: number;
	/**
	 * A starting range, maximumm value is 1024
	 * Set to 1024 if omitted
	 */
	to?: number;
	/**
	 * How long the range should be held for the handler to be
	 * triggered (in ms)
	 */
	minTime?: number;
	/**
	 * A handler that is executed when the pressure falls in given range
	 */
	handler: (
		hookables: ModuleHookables
	) => PRESSURE_REGISTER | Promise<PRESSURE_REGISTER>;
}

export interface PressureChange {
	type: 'change';
	/**
	 * The size of the jump
	 */
	amount: number;
	/**
	 * The direction in which the change occurs
	 */
	direction: PRESSURE_CHANGE_DIRECTION;
	/**
	 * How long the range should be held for the handler to be
	 * triggered (in ms)
	 */
	minTime?: number;
	/**
	 * A handler that is executed when the pressure falls in given range
	 */
	handler: (hookables: ModuleHookables) => PossiblePromise<void>;
}

export interface PressureHooks {
	[key: string]: (PressureRange | PressureChange)[];
}
