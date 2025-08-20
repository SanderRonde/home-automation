import { SettablePromise } from '../../lib/settable-promise';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';

export const KeyVal = new (class KeyVal extends ModuleMeta {
	private _apiHandler: SettablePromise<APIHandler> = new SettablePromise();
	private _db: SettablePromise<Database> = new SettablePromise();

	public name = 'keyval';

	public init(config: ModuleConfig<KeyVal>) {
		const { db } = config;
		this._db.set(db);
		const apiHandler = new APIHandler({ db, keyval: this });
		this._apiHandler.set(apiHandler);

		initRouting({ ...config, apiHandler });
	}
})();
