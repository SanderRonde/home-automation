import { ExternalHandler } from '../../modules/visualize/external';
import { createReporter } from '../../modules/visualize/report';
import { initVisualizerHooks } from '../../config/visualize';
import { ModuleMeta } from '../../modules/meta';
import { ModuleConfig } from '../../modules';
import { Schema } from '../../lib/sql-db';

export type VisualizeDataType = string | number | boolean;

export const Visualize = new (class Visualize extends ModuleMeta {
	public name = 'visualize';

	public get External() {
		return ExternalHandler;
	}

	public get schema() {
		return {
			data: {
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

	public init({ sqlDB, modules }: ModuleConfig<Visualize>) {
		void ExternalHandler.init(sqlDB);

		initVisualizerHooks(modules, createReporter(sqlDB));
	}
})();
