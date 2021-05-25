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
	SAME,
	INVERT,
}
export interface GroupConfig {
	[key: string]: {
		[key: string]: KEYVAL_GROUP_EFFECT;
	};
}
