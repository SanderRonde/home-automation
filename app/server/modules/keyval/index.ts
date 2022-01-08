import { initAggregates } from './aggregates';
import { ExternalHandler } from './external';
import { setDB } from './get-set-listener';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { Bot } from './bot';

export const KeyVal = new (class Meta extends ModuleMeta {
	public name = 'keyval';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig) {
		const { db } = config;
		setDB(db);
		const apiHandler = new APIHandler({ db });
		await ExternalHandler.init({ apiHandler });
		initAggregates(db);

		initRouting({ ...config, apiHandler });
	}
})();
