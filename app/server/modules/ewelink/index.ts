import { ExternalHandler } from './external';
import { initEWeLinkAPI } from './api';
import { ModuleMeta } from '../meta';
import { AllModules } from '..';

export const EWeLink = new (class Meta extends ModuleMeta {
	name = 'ewelink';
	private _ewelinkApiInstance: {
		refreshWebsocket?(): Promise<void>;
	} | null = null;

	init() {
		return Promise.resolve(void 0);
	}

	async notifyModules(modules: unknown) {
		void (async () => {
			await initEWeLinkAPI(modules as AllModules);
		})();
		return Promise.resolve(void 0);
	}

	get External() {
		return ExternalHandler;
	}

	async onBackOnline() {
		if (!this._ewelinkApiInstance) {
			return;
		}

		await this._ewelinkApiInstance.refreshWebsocket?.();
	}
})();
