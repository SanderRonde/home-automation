import { disable, enable, initRegister } from './register';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';

export const Movement = new (class Meta extends ModuleMeta {
	public name = 'movement';

	public get External() {
		return ExternalHandler;
	}

	public init(config: ModuleConfig) {
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
