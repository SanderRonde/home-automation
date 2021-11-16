import { ModuleHookables } from '..';
import { PossiblePromise } from '../../lib/types';

export type WebHookConfig = {
	[key: string]: (
		hookables: ModuleHookables,
		params: Record<string, unknown>
	) => PossiblePromise<void>;
};
