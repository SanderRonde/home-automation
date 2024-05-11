import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '@server/lib/decorators';
import { ResponseLike, attachSourcedMessage } from '@server/lib/logger';
import { HomeDetector } from '@server/modules/home-detector/index';
import { Detector } from '@server/modules/home-detector/classes';
import { HOME_STATE } from '@server/modules/home-detector/types';

export class APIHandler {
	private readonly _detector: Detector;

	public constructor({ detector }: { detector: Detector }) {
		this._detector = detector;
	}

	@errorHandle
	@requireParams('name')
	@auth
	public async get(
		res: ResponseLike,
		{
			name,
		}: {
			name: string;
			auth: string;
		},
		source: string
	): Promise<HOME_STATE | '?'> {
		const result = this._detector.get(name);
		attachSourcedMessage(
			res,
			source,
			await HomeDetector.explainHook,
			`Name: ${name}, val: ${result}`
		);
		res.write(result);
		res.end();
		return result;
	}

	@errorHandle
	@authAll
	public async getAll(
		res: ResponseLike,
		_params: {
			auth: string;
		},
		source: string
	): Promise<Record<string, HOME_STATE | '?'>> {
		const all = this._detector.getAll(true);
		const result = JSON.stringify(all);
		attachSourcedMessage(
			res,
			source,
			await HomeDetector.explainHook,
			`JSON: ${result}`
		);
		res.write(result);
		res.end();
		return all;
	}
}
