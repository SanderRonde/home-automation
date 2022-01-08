import { PossiblePromise } from '../../lib/types';
import { ModuleHookables } from '..';

export type WebHookConfig = {
	[key: string]: (
		hookables: ModuleHookables,
		params: Record<string, unknown>
	) => PossiblePromise<void>;
};
