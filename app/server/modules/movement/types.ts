import type { ModuleHookables } from '..';

export interface MovementHooks {
	[key: string]: ((hookables: ModuleHookables) => unknown)[];
}
