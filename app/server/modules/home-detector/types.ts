import { PossiblePromise } from '@server/lib/types';
import { ModuleHookables } from '..';

export interface HomeHooks {
	[key: string]: {
		home?: {
			[name: string]: (
				hookables: ModuleHookables
			) => PossiblePromise<void>;
		};
		away?: {
			[name: string]: (
				hookables: ModuleHookables
			) => PossiblePromise<void>;
		};
	};
}

export const enum HOME_STATE {
	HOME = 'home',
	AWAY = 'away',
}
