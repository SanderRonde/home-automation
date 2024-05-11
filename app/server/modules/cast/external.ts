import { createExternalClass } from '../../lib/external';
import * as castv2 from 'castv2-player';
import { APIHandler } from './api';
import { Cast } from '.';

export class ExternalHandler extends createExternalClass(true) {
	public async stop(): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest(async (res, source) => {
			return APIHandler.stop(
				res,
				{
					auth: await this._getKey(res, Cast),
				},
				source
			);
		});
	}

	public async pasta(
		pasta: string
	): Promise<castv2.MediaPlayerClass[] | undefined> {
		return this.runRequest(async (res, source) => {
			return APIHandler.pasta(
				res,
				{
					pasta: pasta,
					auth: await this._getKey(res, Cast),
				},
				source
			);
		});
	}

	public async say(
		text: string,
		lang = 'en'
	): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest(async (res, source) => {
			return APIHandler.say(
				res,
				{
					text,
					lang,
					auth: await this._getKey(res, Cast),
				},
				source
			);
		});
	}

	public async url(url: string): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest(async (res, source) => {
			return APIHandler.url(
				res,
				{
					url,
					auth: await this._getKey(res, Cast),
				},
				source
			);
		});
	}
}
