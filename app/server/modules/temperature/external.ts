import { createExternalClass } from '../../lib/external';
import { getController } from './temp-controller';
import { APIHandler } from './api';
import { Temperature } from '.';
import { Mode } from './types';

export class ExternalHandler extends createExternalClass(false) {
	public setMode(name: string, mode: Mode): Promise<void> {
		return this.runRequest(async (res, source) => {
			return APIHandler.setMode(
				res,
				{
					auth: await this._getKey(res, Temperature),
					mode,
					name,
				},
				source
			);
		});
	}

	public setTarget(name: string, target: number): Promise<void> {
		return this.runRequest(async (res, source) => {
			return APIHandler.setTargetTemp(
				res,
				{
					auth: await this._getKey(res, Temperature),
					target,
					name,
				},
				source
			);
		});
	}

	public getTemp(name: string): Promise<{
		temp: number;
	}> {
		return this.runRequest(async (res, source) => {
			return APIHandler.getTemp(
				res,
				{
					auth: await this._getKey(res, Temperature),
					name,
				},
				source
			);
		});
	}

	public moveDir(
		name: string,
		direction: 'left' | 'right',
		ms: number
	): Promise<string> {
		return this.runRequest(async (res, source) => {
			return APIHandler.moveDir(
				res,
				{
					auth: await this._getKey(res, Temperature),
					direction,
					ms,
					name,
				},
				source
			);
		});
	}

	public onUpdate(
		name: string,
		handler: (temperature: number) => void | Promise<void>
	): Promise<void> {
		return this.runRequest(async () => {
			const controller = await getController(name);
			controller.addListener(async (temperature) => {
				await handler(temperature);
			});
		});
	}
}
