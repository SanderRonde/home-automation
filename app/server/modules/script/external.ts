import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logging/lob-obj';
import type { Config } from '../../app';
import { APIHandler } from './api';
import { Script } from '.';

export class ExternalHandler extends createExternalClass(true) {
	private static _config: Config | null = null;

	public static async init({ config }: { config: Config }): Promise<void> {
		this._config = config;
		await super.init();
	}

	public async script(name: string): Promise<string> {
		return this.runRequest(async (res) => {
			return APIHandler.script(
				res,
				{
					name,
					auth: await this._getKey(LogObj.fromRes(res), Script),
				},
				ExternalHandler._config!
			);
		});
	}
}
