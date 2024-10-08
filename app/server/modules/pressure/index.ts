import { LogObj } from '../../lib/logging/lob-obj';
import { PressureStateKeeper } from './enabled';
import { PressureValueKeeper } from './values';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';

export const Pressure = new (class Pressure extends ModuleMeta {
	public name = 'pressure';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig<Pressure>): Promise<void> {
		const stateKeeper = new PressureStateKeeper(config.db);
		const valueKeeper = new PressureValueKeeper(stateKeeper);

		Bot.valueKeeper = valueKeeper;

		await ExternalHandler.init({
			pressureStateKeeper: stateKeeper,
			pressureValueKeeper: valueKeeper,
		});
		initRouting(config, valueKeeper);

		void (async () => {
			const keyval = new config.modules.keyval.External(
				LogObj.fromEvent('PRESSURE.NOTIFY')
			);
			await keyval.set(
				'state.pressure',
				stateKeeper.isEnabled() ? '1' : '0',
				false
			);
			await keyval.onChange(
				'state.pressure',
				async (value) => {
					if (value === '1') {
						await stateKeeper.enable(false);
					} else {
						await stateKeeper.disable(false);
					}
				},
				{ notifyOnInitial: true }
			);
		})();
	}
})();
