import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';
import type { APIHandler } from './api';
import type { ModuleConfig } from '..';
import type { Mode } from './types';
import { Temperature } from '.';

export class ExternalHandler extends createExternalClass(true) {
	private static _db: ModuleConfig<typeof Temperature>['sqlDB'];
	private static _api: APIHandler;

	public static async init({
		db,
		api,
	}: {
		db: ModuleConfig<typeof Temperature>['sqlDB'];
		api: APIHandler;
	}): Promise<void> {
		this._db = db;
		this._api = api;
		await super.init();
	}

	public setMode(name: string, mode: Mode): Promise<void> {
		return this.runRequest(async (res) => {
			return ExternalHandler._api.setMode(res, {
				auth: await this._getKey(LogObj.fromRes(res), Temperature),
				mode,
				name,
			});
		});
	}

	public setTarget(name: string, target: number): Promise<void> {
		return this.runRequest(async (res) => {
			return ExternalHandler._api.setTargetTemp(res, {
				auth: await this._getKey(LogObj.fromRes(res), Temperature),
				target,
				name,
			});
		});
	}

	public getTemp(name: string): Promise<{
		temp: number;
	}> {
		return this.runRequest(async (res) => {
			return ExternalHandler._api.getTemp(res, {
				auth: await this._getKey(LogObj.fromRes(res), Temperature),
				name,
			});
		});
	}

	public moveDir(
		name: string,
		direction: 'left' | 'right',
		ms: number
	): Promise<string> {
		return this.runRequest(async (res) => {
			return ExternalHandler._api.moveDir(res, {
				auth: await this._getKey(LogObj.fromRes(res), Temperature),
				direction,
				ms,
				name,
			});
		});
	}

	public onUpdate(
		name: string,
		handler: (temperature: number) => void | Promise<void>
	): Promise<void> {
		return this.runRequest(async () => {
			const controller = await getController(ExternalHandler._db, name);
			controller.addListener(async (temperature) => {
				await handler(temperature);
			});
		});
	}
}
