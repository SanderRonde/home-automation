import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { ResponseLike, attachMessage } from '../../lib/logger';
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
		attachMessage(res, `Reporting movement for key ${key}`);
		await reportMovement(key, res);
		res.status(200);
		res.end();
	}
}
