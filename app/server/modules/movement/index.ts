import { AllModules, ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { disable, enable, initRegister } from './register';
import { initRouting } from './routing';

export const Movement = new (class Meta extends ModuleMeta {
	name = 'movement';

	async init(config: ModuleConfig) {
		initRegister(config.db);
		initRouting(config);

		return Promise.resolve(void 0);
	}

	notifyModules(modules: unknown) {
		void (async () => {
			await new (modules as AllModules).keyval.External(
				{},
				'MOVEMENT.NOTIFY'
			).onChange(
				'state.movement',
				async (value) => {
					if (value === '1') {
						await enable();
					} else {
						await disable();
					}
				},
				{ notifyOnInitial: true }
			);
		})();
		return Promise.resolve(void 0);
	}
})();
