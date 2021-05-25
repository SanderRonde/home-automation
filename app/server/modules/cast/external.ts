import { createExternalClass } from '../../lib/external';
import * as castv2 from 'castv2-player';
import { APIHandler } from './api';
import { Auth } from '../auth';

export class ExternalHandler extends createExternalClass(true) {
	async stop(): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest((res, source) => {
			return APIHandler.stop(
				res,
				{
					auth: Auth.Secret.getKey(),
				},
				source
			);
		});
	}

	async pasta(pasta: string): Promise<castv2.MediaPlayerClass[] | undefined> {
		return this.runRequest((res, source) => {
			return APIHandler.pasta(
				res,
				{
					pasta: pasta,
					auth: Auth.Secret.getKey(),
				},
				source
			);
		});
	}

	async say(text: string, lang = 'en'): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest((res, source) => {
			return APIHandler.say(
				res,
				{
					text,
					lang,
					auth: Auth.Secret.getKey(),
				},
				source
			);
		});
	}

	async url(url: string): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest((res, source) => {
			return APIHandler.url(
				res,
				{
					url,
					auth: Auth.Secret.getKey(),
				},
				source
			);
		});
	}
}
