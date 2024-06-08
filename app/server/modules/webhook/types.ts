import type { PossiblePromise } from '../../lib/types';
import type { ModuleHookables } from '..';

export type WebHookConfig = {
	[key: string]: (
		hookables: ModuleHookables,
		params: Record<string, unknown>
	) => PossiblePromise<void>;
};
