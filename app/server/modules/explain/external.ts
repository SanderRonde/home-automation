import { createExternalClass } from '../../lib/external';
import { Action } from './explaining';
import { APIHandler } from './api';
import { Auth } from '../auth';

export class ExternalHandler extends createExternalClass(false) {
	public requiresInit = false;

	public explainTime(mins: number, announce = false): Promise<Action[]> {
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

	public explainAmount(amount: number, announce = false): Promise<Action[]> {
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
