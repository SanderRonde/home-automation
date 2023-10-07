import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { ResponseLike, attachMessage } from '../../lib/logger';
import { PressureValueKeeper } from './values';

export class APIHandler {
	public constructor(private readonly _valueKeeper: PressureValueKeeper) {}

	@errorHandle
	@requireParams('key', 'pressure')
	@auth
	public async reportPressure(
		res: ResponseLike,
		{
			key,
			pressure,
		}: {
			auth?: string;
			key: string;
			pressure: string;
		}
	): Promise<void> {
		attachMessage(res, `Setting pressure key ${key} to ${pressure}`);
		await this._valueKeeper.setPressure(key, ~~pressure, res);
		res.status(200);
		res.end();
	}
}
