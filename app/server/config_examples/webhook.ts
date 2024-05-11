import { WebHookConfig } from '@server/modules/webhook/types';
import { ModuleHookables } from '@server/modules';

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
