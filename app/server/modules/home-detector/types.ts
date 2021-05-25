import { ModuleHookables } from '..';
import { PossiblePromise } from '../../lib/type';

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
