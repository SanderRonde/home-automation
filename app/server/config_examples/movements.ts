import { MovementHooks } from '../modules/movement/types';
import { ModuleHookables } from '../modules';

export default {
	'some-name': [
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		async (_modules: ModuleHookables) => {
			// Do something with modules
		},
	],
} as MovementHooks;
