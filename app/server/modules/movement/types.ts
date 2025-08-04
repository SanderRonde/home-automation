import type { LogObj } from '../../lib/logging/lob-obj';
import type { AllModules } from '..';

export interface MovementHooks {
	[key: string]: ((hookables: AllModules, logObj: LogObj) => unknown)[];
}
