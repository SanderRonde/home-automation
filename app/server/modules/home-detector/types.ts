import type { LogObj } from '../../lib/logging/lob-obj';
import type { PossiblePromise } from '../../lib/types';
import type { AllModules } from '..';

export interface HomeHooks {
	[key: string]: {
		home?: {
			[name: string]: (hookables: AllModules, logObj: LogObj) => PossiblePromise<void>;
		};
		away?: {
			[name: string]: (hookables: AllModules, logObj: LogObj) => PossiblePromise<void>;
		};
	};
}

export const enum HOME_STATE {
	HOME = 'home',
	AWAY = 'away',
}
