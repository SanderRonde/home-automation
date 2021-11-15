import { ModuleHookables } from '..';
import { PossiblePromise } from '../../lib/types';

export type WebHookConfig = {
	[key: string]: (hookables: ModuleHookables) => PossiblePromise<void>;
};
