import type { LogObj } from '../../lib/logging/lob-obj';
import type { PossiblePromise } from '../../lib/types';
import type { AllModules } from '..';

export type WebHookConfig = {
	[key: string]: (
		hookables: AllModules,
		logObj: LogObj,
		params: Record<string, unknown>
	) => PossiblePromise<void>;
};
