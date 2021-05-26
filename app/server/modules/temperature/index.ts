import { AllModules, ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { initTempController } from './temp-controller';

export const Temperature = new (class Temperature extends ModuleMeta {
	name = 'temperature';

	async init(config: ModuleConfig) {
		initTempController(config.db);

		initRouting(config);

		return Promise.resolve(void 0);
	}

	get External() {
		return ExternalHandler;
	}

	notifyModules(modules: unknown): Promise<void> {
		void new (modules as AllModules).keyval.External(
			{},
			'TEMPERATURE.INIT'
		).onChange('room.heating', async (value, logObj) => {
			return new ExternalHandler(logObj, 'TEMPERATURE.INIT').setMode(
				'room',
				value === '1' ? 'on' : 'off'
			);
		});

		return Promise.resolve(void 0);
	}

	get Bot() {
		return Bot;
	}
})();
