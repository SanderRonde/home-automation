import { initTempController } from './temp-controller';
import { AllModules, ModuleConfig } from '..';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';

export const Temperature = new (class Temperature extends ModuleMeta {
	public name = 'temperature';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig) {
		initTempController(config.db);

		initRouting(config);

		return Promise.resolve(void 0);
	}

	public notifyModules(modules: unknown): Promise<void> {
		if (getEnv('HEATING_KEY', false)) {
			void new (modules as AllModules).keyval.External(
				{},
				'TEMPERATURE.INIT'
			).onChange(
				getEnv('HEATING_KEY', true),
				async (value, _key, logObj) => {
					return new ExternalHandler(
						logObj,
						'TEMPERATURE.INIT'
					).setMode('room', value === '1' ? 'on' : 'off');
				}
			);
		}

		return Promise.resolve(void 0);
	}
})();
