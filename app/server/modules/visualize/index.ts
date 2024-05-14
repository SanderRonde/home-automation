import { ExternalHandler } from '../../modules/visualize/external';
import { createReporter } from '../../modules/visualize/report';
import { initVisualizerHooks } from '../../config/visualize';
import { ModuleMeta } from '../../modules/meta';
import { ModuleConfig } from '../../modules';
import { Schema } from '../../lib/sql-db';
import { initRouting } from './routing';

export type VisualizeDataType = string | number | boolean;

export const Visualize = new (class Visualize extends ModuleMeta {
	public name = 'visualize';

	public get External() {
		return ExternalHandler;
	}

	public get schema() {
		return {
			data: {
				time: {
					type: 'INTEGER',
					nullable: false,
				},
				tag: {
					type: 'TEXT',
					nullable: false,
				},
				key: {
					type: 'TEXT',
					nullable: false,
				},
				/** JSON */
				datum: {
					type: 'TEXT',
					nullable: false,
					json: '' as VisualizeDataType,
				},
			},
		} as const satisfies Schema;
	}

	public async init(config: ModuleConfig<Visualize>) {
		await ExternalHandler.init(config.sqlDB);
		initRouting(config);

		initVisualizerHooks(config.modules, createReporter(config.sqlDB));
	}
})();
