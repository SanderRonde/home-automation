import { WakelightLogic } from './wakelight-logic';
import type { AllModules, ModuleConfig } from '..';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';

export const Wakelight = new (class Wakelight extends ModuleMeta {
	public name = 'wakelight';
	private _logic: WakelightLogic | null = null;

	public init(config: ModuleConfig) {
		this._logic = new WakelightLogic(
			config.db,
			this.getModules<AllModules>().then((modules) => modules.device.api.value) as unknown
		);

		return {
			serve: initRouting(config.db, this._logic),
		};
	}
})();
