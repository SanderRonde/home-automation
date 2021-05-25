import { createExternalClass } from '../../lib/external';
import { Auth } from '../auth';
import { APIHandler } from './api';
import { Action } from './explaining';

export class ExternalHandler extends createExternalClass(false) {
	requiresInit = false;

	explainTime(mins: number, announce = false): Promise<Action[]> {
		return this.runRequest(async (res, source) => {
			return APIHandler.getLastXMins(
				res,
				{
					mins,
					announce: announce,
					auth: await this._getKey(res, Auth),
				},
				source
			);
		});
	}

	explainAmount(amount: number, announce = false): Promise<Action[]> {
		return this.runRequest(async (res, source) => {
			return APIHandler.getLastX(
				res,
				{
					amount,
					announce: announce,
					auth: await this._getKey(res, Auth),
				},
				source
			);
		});
	}
}
