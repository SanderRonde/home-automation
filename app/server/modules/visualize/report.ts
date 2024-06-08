import type { ModuleConfig, Visualize } from '../modules';
import type { VisualizeDataType } from '.';

export function report(
	db: ModuleConfig<typeof Visualize>['sqlDB'],
	tag: string,
	key: string,
	datum: VisualizeDataType
): Promise<void> {
	return db.data.insert({ tag, key, datum, time: Date.now() });
}

export function createReporter(db: ModuleConfig<typeof Visualize>['sqlDB']) {
	return (
		tag: string,
		key: string,
		datum: VisualizeDataType
	): Promise<void> => {
		return report(db, tag, key, datum);
	};
}
