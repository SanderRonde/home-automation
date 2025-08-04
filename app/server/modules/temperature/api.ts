import type { ResponseLike } from '../../lib/logging/response-logger';
import { errorHandle, authAll } from '../../lib/decorators';
import type { ModuleConfig, Temperature } from '..';
import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';

export class APIHandler {
	public constructor(
		private readonly _db: ModuleConfig<typeof Temperature>['sqlDB']
	) {}

	@errorHandle
	@authAll
	public async getTemp(
		res: ResponseLike,
		{
			name,
		}: {
			auth?: string;
			name: string;
		}
	): Promise<{
		temp: number;
	}> {
		const controller = await getController(this._db, name);
		LogObj.fromRes(res).attachMessage(
			`Getting temp. Returning ${controller.getLastTemp()}`
		);
		res.status(200);
		res.write(
			JSON.stringify({
				temp: controller.getLastTemp(),
			})
		);
		res.end();
		return {
			temp: controller.getLastTemp(),
		};
	}
}
