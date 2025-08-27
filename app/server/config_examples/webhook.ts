import type { WebHookConfig } from '../modules/webhook/types';
import type { AllModules } from '../modules/modules';

export default {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	someName: async (_modules: AllModules) => {
		// Do something
	},
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	otherName: async (_modules: AllModules) => {
		// Do something else
	},
} as WebHookConfig;
