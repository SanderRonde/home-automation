import { AllModules, ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import { ExternalHandler } from './external';
import { initRegister } from './register';
import { initRouting } from './routing';

export const Pressure = new (class Meta extends ModuleMeta {
	name = 'pressure';

	init(config: ModuleConfig): Promise<void> {
		initRegister(config.db);
		initRouting(config);
		return Promise.resolve(void 0);
	}

	async notifyModules(modules: unknown) {
		void (async () => {
			await new (modules as AllModules).keyval.External(
				{},
				'PRESSURE.NOTIFY'
			).onChange(
				'state.pressure',
				async (value, logObj) => {
					const handler = new ExternalHandler(logObj, 'KEYVAL');
					if (value === '1') {
						await handler.enable();
					} else {
						await handler.disable();
					}
				},
				{ notifyOnInitial: true }
			);
		})();
		return Promise.resolve(void 0);
	}

	get External() {
		return ExternalHandler;
	}

	get Bot() {
		return Bot;
	}
})();
