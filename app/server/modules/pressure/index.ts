import { LogObj } from '../../lib/logging/lob-obj';
import { PressureStateKeeper } from './enabled';
import { PressureValueKeeper } from './values';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Pressure = new (class Pressure extends ModuleMeta {
	public name = 'pressure';

	public init(config: ModuleConfig<Pressure>): void {
		const stateKeeper = new PressureStateKeeper(config.db);
		const valueKeeper = new PressureValueKeeper(stateKeeper);

		initRouting(config, valueKeeper);

		void (async () => {
			await config.modules.keyval.set(
				LogObj.fromEvent('PRESSURE.NOTIFY'),
				'state.pressure',
				stateKeeper.isEnabled() ? '1' : '0',
				false
			);
			config.modules.keyval.onChange(
				LogObj.fromEvent('PRESSURE.NOTIFY'),
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
