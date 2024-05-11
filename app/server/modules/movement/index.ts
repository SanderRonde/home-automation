import { disable, enable, initRegister } from '@server/modules/movement/register';
import { ExternalHandler } from '@server/modules/movement/external';
import { initRouting } from '@server/modules/movement/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

export const Movement = new (class Movement extends ModuleMeta {
	public name = 'movement';

	public get External() {
		return ExternalHandler;
	}

	public init(config: ModuleConfig<Movement>) {
		initRegister(config.db);
		initRouting(config);

		void (async () => {
			await new config.modules.keyval.External(
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
	}
})();
