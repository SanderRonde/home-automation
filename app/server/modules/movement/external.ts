import { Movement } from '.';
import { createExternalClass } from '../../lib/external';
import { APIHandler } from './api';

export class ExternalHandler extends createExternalClass(false) {
	async reportMovement(key: string): Promise<void> {
		return this.runRequest(async (res, source) => {
			return APIHandler.reportMovement(
				res,
				{
					key,
					auth: await this._getKey(res, Movement),
				},
				source
			);
		});
	}
}
