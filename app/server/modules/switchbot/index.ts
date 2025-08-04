import { scanSwitchbots } from './scanner';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const SwitchBot = new (class SwitchBot extends ModuleMeta {
	public name = 'switchbot';

	public init({ modules }: ModuleConfig<SwitchBot>) {
		void (async () => {
			await scanSwitchbots(modules);
		})();
	}
})();
