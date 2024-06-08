import type { WebHookConfig } from '../modules/webhook/types';
import type { ModuleHookables } from '../modules';

export default {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	someName: async (_modules: ModuleHookables) => {
		// Do something
	},
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	otherName: async (_modules: ModuleHookables) => {
		// Do something else
	},
} as WebHookConfig;
