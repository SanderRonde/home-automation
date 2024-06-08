import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logging/lob-obj';
import type * as castv2 from 'castv2-player';
import { APIHandler } from './api';
import { Cast } from '.';

export class ExternalHandler extends createExternalClass(true) {
	public async stop(): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest(async (res) => {
			return APIHandler.stop(res, {
				auth: await this._getKey(LogObj.fromRes(res), Cast),
			});
		});
	}

	public async pasta(
		pasta: string
	): Promise<castv2.MediaPlayerClass[] | undefined> {
		return this.runRequest(async (res) => {
			return APIHandler.pasta(res, {
				pasta: pasta,
				auth: await this._getKey(LogObj.fromRes(res), Cast),
			});
		});
	}

	public async say(
		text: string,
		lang = 'en'
	): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest(async (res) => {
			return APIHandler.say(res, {
				text,
				lang,
				auth: await this._getKey(LogObj.fromRes(res), Cast),
			});
		});
	}

	public async url(url: string): Promise<castv2.MediaPlayerClass[]> {
		return this.runRequest(async (res) => {
			return APIHandler.url(res, {
				url,
				auth: await this._getKey(LogObj.fromRes(res), Cast),
			});
		});
	}
}
