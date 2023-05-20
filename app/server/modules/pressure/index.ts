import { initRegister, isEnabled } from './register';
import { AllModules, ModuleConfig } from '..';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';

export const Pressure = new (class Meta extends ModuleMeta {
	public name = 'pressure';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig): Promise<void> {
		initRegister(config.db);
		initRouting(config);
		return Promise.resolve(void 0);
	}

	public async notifyModules(modules: unknown) {
		void (async () => {
			const keyval = new (modules as AllModules).keyval.External(
				{},
				'PRESSURE.NOTIFY'
			);
			await keyval.set('state.pressure', isEnabled() ? '1' : '0', false);
			await keyval.onChange(
				'state.pressure',
				async (value, _key, logObj) => {
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
})();
