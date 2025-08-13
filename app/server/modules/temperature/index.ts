import { ResDummy } from '../../lib/logging/response-logger';
import { SettablePromise } from '../../lib/settable-promise';
import type { Schema } from '../../lib/sql-db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';

export const Temperature = new (class Temperature extends ModuleMeta {
	private _api: SettablePromise<APIHandler> = new SettablePromise();

	public name = 'temperature';

	public get schema() {
		return {
			modes: {
				location: {
					type: 'TEXT',
					nullable: false,
					primaryKey: true,
				},
				mode: {
					type: 'TEXT',
					nullable: false,
					enum: ['on', 'off', 'auto'],
				},
			},
			targets: {
				location: {
					type: 'TEXT',
					nullable: false,
					primaryKey: true,
				},
				target: {
					type: 'INTEGER',
					nullable: false,
				},
			},
			temperatures: {
				time: {
					type: 'INTEGER',
					nullable: false,
					primaryKey: true,
				},
				location: {
					type: 'TEXT',
					nullable: false,
				},
				temperature: {
					type: 'INTEGER',
					nullable: false,
				},
			},
		} as const satisfies Schema;
	}

	public init(config: ModuleConfig<Temperature>) {
		const api = new APIHandler(config.sqlDB);
		this._api.set(api);
		initRouting(api, config);
	}

	public async getTemp(name: string) {
		const api = await this._api.value;
		return api.getTemp(new ResDummy(), { name });
	}
})();
