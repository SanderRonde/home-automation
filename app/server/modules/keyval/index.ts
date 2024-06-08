import { initAggregates } from './aggregates';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';
import { Bot } from './bot';

export const KeyVal = new (class KeyVal extends ModuleMeta {
	public name = 'keyval';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig<KeyVal>) {
		const { db } = config;
		const apiHandler = new APIHandler({ db });
		await ExternalHandler.init({ apiHandler });
		initAggregates(db);

		initRouting({ ...config, apiHandler });
	}
})();
