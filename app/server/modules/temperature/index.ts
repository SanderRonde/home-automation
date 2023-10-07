import { initTempController } from './temp-controller';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';
import { Bot } from './bot';

export const Temperature = new (class Temperature extends ModuleMeta {
	public name = 'temperature';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig) {
		initTempController(config.db);

		initRouting(config);

		if (getEnv('HEATING_KEY', false)) {
			void new config.modules.keyval.External(
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
	}
})();
