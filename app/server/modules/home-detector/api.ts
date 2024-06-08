import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import type { Detector } from './classes';
import type { HOME_STATE } from './types';

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
		LogObj.fromRes(res).attachMessage(`Name: ${name}, val: ${result}`);
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
		LogObj.fromRes(res).attachMessage(`JSON: ${result}`);
		res.write(result);
		res.end();
		return all;
	}
}
