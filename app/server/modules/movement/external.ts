import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logging/lob-obj';
import { APIHandler } from './api';
import { Movement } from '.';

export class ExternalHandler extends createExternalClass(false) {
	public async reportMovement(key: string): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.reportMovement(res, {
				key,
				auth: await this._getKey(LogObj.fromRes(res), Movement),
			});
		});
	}
}
