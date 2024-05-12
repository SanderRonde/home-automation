import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '../../lib/decorators';
import { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';
import { ModuleConfig, Temperature } from '..';
import { Mode } from './types';

export class APIHandler {
	public constructor(
		private readonly _db: ModuleConfig<typeof Temperature>['sqlDB']
	) {}

	@errorHandle
	@requireParams('mode', 'name')
	@auth
	public async setMode(
		res: ResponseLike,
		{
			mode,
			name,
		}: {
			auth?: string;
			mode: Mode;
			name: string;
		}
	): Promise<void> {
		const controller = await getController(this._db, name);
		const oldMode = controller.getMode();
		LogObj.fromRes(res).attachMessage(
			`Setting mode to ${mode} from ${oldMode}`
		);
		await controller.setMode(mode, LogObj.fromRes(res));
		res.status(200);
		res.end();
	}

	@errorHandle
	@requireParams('target', 'name')
	@auth
	public async setTargetTemp(
		res: ResponseLike,
		{
			target,
			name,
		}: {
			auth?: string;
			target: number;
			name: string;
		}
	): Promise<void> {
		const controller = await getController(this._db, name);
		const oldTemp = controller.getTarget();
		LogObj.fromRes(res).attachMessage(
			`Setting target temp to ${target} from ${oldTemp}`
		);
		await controller.setTarget(target);
		res.status(200);
		res.end();
	}

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

	@errorHandle
	@authAll
	public async moveDir(
		res: ResponseLike,
		{
			name,
			direction,
			ms,
		}: {
			auth?: string;
			name: string;
			direction: 'left' | 'right';
			ms: number;
		}
	): Promise<string> {
		const controller = await getController(this._db, name);
		LogObj.fromRes(res).attachMessage(
			`Setting move for controller ${name} to ${ms}ms in the direction ${direction}`
		);
		controller.setMove(direction, ms);
		res.status(200);
		res.write('OK');
		res.end();
		return 'OK';
	}
}
