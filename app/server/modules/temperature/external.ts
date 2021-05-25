import { createExternalClass } from '../../lib/external';
import { Auth } from '../auth';
import { APIHandler } from './api';
import { getController } from './temp-controller';
import { Mode } from './types';

export class ExternalHandler extends createExternalClass(false) {
	public setMode(name: string, mode: Mode): Promise<void> {
		return this.runRequest((res, source) => {
			return APIHandler.setMode(
				res,
				{
					// TODO: replace with external
					auth: Auth.Secret.getKey(),
					mode,
					name,
				},
				source
			);
		});
	}

	public setTarget(name: string, target: number): Promise<void> {
		return this.runRequest((res, source) => {
			return APIHandler.setTargetTemp(
				res,
				{
					auth: Auth.Secret.getKey(),
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
		return this.runRequest((res, source) => {
			return APIHandler.getTemp(
				res,
				{
					auth: Auth.Secret.getKey(),
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
		return this.runRequest((res, source) => {
			return APIHandler.moveDir(
				res,
				{
					auth: Auth.Secret.getKey(),
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
		handler: (temperature: number) => void
	): Promise<void> {
		return this.runRequest(async () => {
			const controller = await getController(name);
			controller.addListener((temperature) => {
				handler(temperature);
			});
		});
	}
}
