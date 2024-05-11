import { auth, errorHandle, requireParams } from '../../lib/decorators';
import { ResponseLike, attachSourcedMessage } from '../../lib/logger';
import { reportMovement } from './register';
import { Movement } from '.';

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
		},
		source: string
	): Promise<void> {
		attachSourcedMessage(
			res,
			source,
			await Movement.explainHook,
			`Reporting movement for key ${key}`
		);
		await reportMovement(key, res);
		res.status(200);
		res.end();
	}
}
