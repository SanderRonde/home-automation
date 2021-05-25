import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { initAggregates } from './aggregates';
import { APIHandler } from './api';
import { Bot } from './bot';
import { ExternalHandler } from './external';
import { setDB } from './get-set-listener';
import { initRouting } from './routing';

export const KeyVal = new (class Meta extends ModuleMeta {
	name = 'keyval';

	async init(config: ModuleConfig) {
		const { db } = config;
		setDB(db);
		const apiHandler = new APIHandler({ db });
		await ExternalHandler.init({ apiHandler });
		initAggregates(db);

		initRouting({ ...config, apiHandler });
	}

	get external() {
		return ExternalHandler;
	}

	get bot() {
		return Bot;
	}
})();
