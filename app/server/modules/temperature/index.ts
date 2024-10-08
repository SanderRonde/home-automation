import { LogObj } from '../../lib/logging/lob-obj';
import type { Schema } from '../../lib/sql-db';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';
import { Bot } from './bot';

export const Temperature = new (class Temperature extends ModuleMeta {
	public name = 'temperature';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

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
		initRouting(api, config);
		void ExternalHandler.init({
			db: config.sqlDB,
			api: api,
		});

		if (getEnv('HEATING_KEY', false)) {
			void new config.modules.keyval.External(
				LogObj.fromEvent('TEMPERATURE.INIT')
			).onChange(
				getEnv('HEATING_KEY', true),
				async (value, _key, logObj) => {
					return new ExternalHandler(logObj).setMode(
						'room',
						value === '1' ? 'on' : 'off'
					);
				}
			);
		}
	}
})();
