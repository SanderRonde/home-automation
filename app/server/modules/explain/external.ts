import { createExternalClass } from '@server/lib/external';
import { Action } from '@server/modules/explain/explaining';
import { APIHandler } from '@server/modules/explain/api';
import { Auth } from '@server/modules/auth';

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
