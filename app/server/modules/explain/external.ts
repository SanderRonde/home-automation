import { createExternalClass } from '../../lib/external';
import { Auth } from '../auth';
import { APIHandler } from './api';
import { Action } from './explaining';

export class ExternalHandler extends createExternalClass(false) {
	requiresInit = false;

	explainTime(mins: number, announce = false): Promise<Action[]> {
		return this.runRequest((res, source) => {
			return APIHandler.getLastXMins(
				res,
				{
					mins,
					announce: announce,
					// TODO: use external
					auth: Auth.Secret.getKey(),
				},
				source
			);
		});
	}

	explainAmount(amount: number, announce = false): Promise<Action[]> {
		return this.runRequest((res, source) => {
			return APIHandler.getLastX(
				res,
				{
					amount,
					announce: announce,
					// TODO: use external
					auth: Auth.Secret.getKey(),
				},
				source
			);
		});
	}
}
