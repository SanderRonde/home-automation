import { PressureStateKeeper } from '@server/modules/pressure/enabled';
import { PressureValueKeeper } from '@server/modules/pressure/values';
import { ExternalHandler } from '@server/modules/pressure/external';
import { initRouting } from '@server/modules/pressure/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/pressure/bot';

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
				{},
				'PRESSURE.NOTIFY'
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
