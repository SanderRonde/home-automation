import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
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
		LogObj.fromRes(res).attachMessage(
			`Setting pressure key ${key} to ${pressure}`
		);
		await this._valueKeeper.setPressure(
			key,
			~~pressure,
			LogObj.fromRes(res)
		);
		res.status(200);
		res.end();
	}
}
