import { initAggregates } from '@server/modules/keyval/aggregates';
import { ExternalHandler } from '@server/modules/keyval/external';
import { setDB } from '@server/modules/keyval/get-set-listener';
import { initRouting } from '@server/modules/keyval/routing';
import { ModuleMeta } from '@server/modules/meta';
import { APIHandler } from '@server/modules/keyval/api';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/keyval/bot';

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
		setDB(db);
		const apiHandler = new APIHandler({ db });
		await ExternalHandler.init({ apiHandler });
		initAggregates(db);

		initRouting({ ...config, apiHandler });
	}
})();
