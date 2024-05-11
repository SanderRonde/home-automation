import { ModuleConfig, Visualize } from '../modules';
import { VisualizeDataType } from '.';

export function report(
	db: ModuleConfig<typeof Visualize>['sqlDB'],
	tag: string,
	key: string,
	datum: VisualizeDataType
): Promise<void> {
	return db.data.insert({ tag, key, datum });
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
