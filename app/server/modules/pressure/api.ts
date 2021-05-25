import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { ResponseLike, attachMessage } from '../../lib/logger';
import { setPressure } from './register';

export class APIHandler {
	@errorHandle
	@requireParams('key', 'pressure')
	@auth
	public static async reportPressure(
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
		await setPressure(key, ~~pressure, res);
		res.status(200);
		res.end();
	}
}
