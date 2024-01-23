import { ModuleHookables } from '..';

export interface KeyvalHooks {
	[key: string]: {
		on?: {
			[name: string]: (
				hookables: ModuleHookables
			) => unknown | Promise<unknown>;
		};
		off?: {
			[name: string]: (
				hookables: ModuleHookables
			) => unknown | Promise<unknown>;
		};
	};
}

export const enum KEYVAL_GROUP_EFFECT {
	SAME_ALWAYS,
	INVERT_ALWAYS,
	SAME_ON_TRUE,
	SAME_ON_FALSE,
	INVERT_ON_TRUE,
	INVERT_ON_FALSE
}
export interface GroupConfig {
	[key: string]: {
		[key: string]: KEYVAL_GROUP_EFFECT;
	};
}
