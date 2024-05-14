import { ResponseLike } from '../../lib/logging/response-logger';
import { errorHandle, authAll } from '../../lib/decorators';
import { LogObj } from '../../lib/logging/lob-obj';
import { getData } from '../../config/visualize';
import { ModuleConfig, Visualize } from '..';

export class APIHandler {
	private readonly _db: ModuleConfig<typeof Visualize>['sqlDB'];

	public constructor({
		db,
	}: {
		db: ModuleConfig<typeof Visualize>['sqlDB'];
	}) {
		this._db = db;
	}

	@errorHandle
	@authAll
	public async data(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: {
			auth?: string;
		}
	): Promise<void> {
		const data = JSON.stringify(await getData(this._db));
		LogObj.fromRes(res).attachMessage(data.slice(0, 50));
		res.status(200).write(data);
		res.end();
	}
}
