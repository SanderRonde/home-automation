import { disable, enable, initRegister } from './register';
import { AllModules, ModuleConfig } from '..';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';

export const Movement = new (class Meta extends ModuleMeta {
	public name = 'movement';

	public get External() {
		return ExternalHandler;
	}

	public async init(config: ModuleConfig) {
		initRegister(config.db);
		initRouting(config);

		return Promise.resolve(void 0);
	}

	public notifyModules(modules: unknown) {
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
