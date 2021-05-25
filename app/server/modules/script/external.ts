import { Config } from '../../app';
import { createExternalClass } from '../../lib/external';
import { Auth } from '../auth';
import { APIHandler } from './api';

export class ExternalHandler extends createExternalClass(true) {
	private static _config: Config | null = null;

	static async init({ config }: { config: Config }): Promise<void> {
		this._config = config;
		await super.init();
	}

	async script(name: string): Promise<string> {
		return this.runRequest((res, source) => {
			return APIHandler.script(
				res,
				{
					name,
					// TODO: replace with external
					auth: Auth.Secret.getKey(),
				},
				ExternalHandler._config!,
				source
			);
		});
	}
}
