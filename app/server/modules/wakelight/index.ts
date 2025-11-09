import { WakelightLogic } from './wakelight-logic';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Wakelight = new (class Wakelight extends ModuleMeta {
	public name = 'wakelight';
	private _logic: WakelightLogic | null = null;

	public init(config: ModuleConfig) {
		this._logic = new WakelightLogic(config.db, <T>() => this.getModules<T>());

		return {
			serve: initRouting(config.db, this._logic),
		};
	}
})();
