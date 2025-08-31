import { getController } from './temp-controller';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Temperature = new (class Temperature extends ModuleMeta {
	public name = 'temperature';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}

	public async getTemp(name: string) {
		const controller = await getController(await this._sqlDB.value, name);
		return controller.getLastTemp();
	}
})();
