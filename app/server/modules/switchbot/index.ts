import { scanSwitchbots } from './scanner';
import { ModuleMeta } from '../meta';
import { AllModules } from '..';

export const SwitchBot = new (class Meta extends ModuleMeta {
	public name = 'switchbot';

	public init() {
		return Promise.resolve(void 0);
	}

	public async notifyModules(modules: unknown) {
		void scanSwitchbots(modules as AllModules);

		return Promise.resolve(void 0);
	}
})();
