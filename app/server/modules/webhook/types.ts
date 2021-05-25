import { ModuleHookables } from '..';
import { PossiblePromise } from '../../lib/type';

export type WebHookConfig = {
	[key: string]: (hookables: ModuleHookables) => PossiblePromise<void>;
};
