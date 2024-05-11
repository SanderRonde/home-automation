import { MovementHooks } from '@server/modules/movement/types';
import { ModuleHookables } from '@server/modules';

export default {
	'some-name': [
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async (_modules: ModuleHookables) => {
			// Do something with modules
		},
	],
} as MovementHooks;
