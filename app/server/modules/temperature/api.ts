import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '../../lib/decorators';
import { ResponseLike, attachSourcedMessage } from '../../lib/logger';
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
		},
		source: string
	): Promise<void> {
		const controller = await getController(this._db, name);
		const oldMode = controller.getMode();
		attachSourcedMessage(
			res,
			source,
			await Temperature.explainHook,
			`Setting mode to ${mode} from ${oldMode}`
		);
		await controller.setMode(mode);
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
		},
		source: string
	): Promise<void> {
		const controller = await getController(this._db, name);
		const oldTemp = controller.getTarget();
		attachSourcedMessage(
			res,
			source,
			await Temperature.explainHook,
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
		},
		source: string
	): Promise<{
		temp: number;
	}> {
		const controller = await getController(this._db, name);
		attachSourcedMessage(
			res,
			source,
			await Temperature.explainHook,
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
		},
		source: string
	): Promise<string> {
		const controller = await getController(this._db, name);
		attachSourcedMessage(
			res,
			source,
			await Temperature.explainHook,
			`Setting move for controller ${name} to ${ms}ms in the direction ${direction}`
		);
		controller.setMove(direction, ms);
		res.status(200);
		res.write('OK');
		res.end();
		return 'OK';
	}
}
