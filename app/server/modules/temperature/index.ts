import { ExternalHandler } from '@server/modules/temperature/external';
import { Schema } from '@server/lib/sql-db';
import { initRouting } from '@server/modules/temperature/routing';
import { getEnv } from '@server/lib/io';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/temperature/bot';

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
		initRouting(config);

		if (getEnv('HEATING_KEY', false)) {
			void new config.modules.keyval.External(
				{},
				'TEMPERATURE.INIT'
			).onChange(
				getEnv('HEATING_KEY', true),
				async (value, _key, logObj) => {
					return new ExternalHandler(
						logObj,
						'TEMPERATURE.INIT'
					).setMode('room', value === '1' ? 'on' : 'off');
				}
			);
		}
	}
})();
