import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '../../lib/decorators';
import { ResponseLike, attachMessage } from '../../lib/logger';
import { Detector } from './classes';
import { HOME_STATE } from './types';

export class APIHandler {
	private readonly _detector: Detector;

	public constructor({ detector }: { detector: Detector }) {
		this._detector = detector;
	}

	@errorHandle
	@requireParams('name')
	@auth
	public get(
		res: ResponseLike,
		{
			name,
		}: {
			name: string;
			auth: string;
		}
	): HOME_STATE | '?' {
		const result = this._detector.get(name);
		attachMessage(res, `Name: ${name}, val: ${result}`);
		res.write(result);
		res.end();
		return result;
	}

	@errorHandle
	@authAll
	public getAll(
		res: ResponseLike,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params?: {
			auth: string;
		}
	): Record<string, HOME_STATE | '?'> {
		const all = this._detector.getAll(true);
		const result = JSON.stringify(all);
		attachMessage(res, `JSON: ${result}`);
		res.write(result);
		res.end();
		return all;
	}
}
