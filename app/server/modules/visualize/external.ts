import { createExternalClass } from '../../lib/external';
import { report } from '../../modules/visualize/report';
import { ModuleConfig } from '../../modules';
import { Visualize } from '.';

export class ExternalHandler extends createExternalClass(true) {
	private static _db: ModuleConfig<typeof Visualize>['sqlDB'];

	public static async init(
		db: ModuleConfig<typeof Visualize>['sqlDB']
	): Promise<void> {
		ExternalHandler._db = db;
		return super.init();
	}

	public async report(
		tag: string,
		key: string,
		value: string | number | boolean
	): Promise<void> {
		return this.runRequest(() => {
			return report(ExternalHandler._db, tag, key, value);
		});
	}
}
