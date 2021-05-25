import express = require('express');
import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logger';
import { remoteControlHTML } from '../../templates/remote-control-template';

export class WebPageHandler {
	constructor(private _randomNum: number) {}

	@errorHandle
	@authCookie
	@upgradeToHTTPS
	public index(res: ResponseLike, _req: express.Request): void {
		res.status(200);
		res.contentType('.html');
		res.write(remoteControlHTML(this._randomNum));
		res.end();
	}
}
