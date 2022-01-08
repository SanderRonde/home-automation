import { errorHandle, authCookie, upgradeToHTTPS } from '../../lib/decorators';
import { remoteControlHTML } from '../../templates/remote-control-template';
import { ResponseLike } from '../../lib/logger';

export class WebPageHandler {
	public constructor(private readonly _randomNum: number) {}

	@errorHandle
	@authCookie
	@upgradeToHTTPS
	public index(res: ResponseLike): void {
		res.status(200);
		res.contentType('.html');
		res.write(remoteControlHTML(this._randomNum));
		res.end();
	}
}
