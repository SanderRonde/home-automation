import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import { reportMovement } from './register';

export class APIHandler {
	@errorHandle
	@requireParams('key')
	@auth
	public static async reportMovement(
		res: ResponseLike,
		{
			key,
		}: {
			auth?: string;
			key: string;
		}
	): Promise<void> {
		LogObj.fromRes(res).attachMessage( `Reporting movement for key ${key}`);
		await reportMovement(key, LogObj.fromRes(res));
		res.status(200);
		res.end();
	}
}
