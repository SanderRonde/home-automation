import { ExternalHandler } from '../../movement/external';
import { EWeLinkInittable, EWeLinkSharedConfig } from './shared';

export class EwelinkMovement extends EWeLinkInittable {
	private _movementExternal!: ExternalHandler;

	constructor(
		private _eWeLinkConfig: EWeLinkSharedConfig,
		private _movementKey: string
	) {
		super();
	}

	init(): Promise<void> {
		this._movementExternal =
			new this._eWeLinkConfig.modules.movement.External(
				{},
				'EWELINK.MOVEMENT.INIT'
			);
		this._eWeLinkConfig.wsConnection.on('data', async (data) => {
			if (
				typeof data === 'object' &&
				'deviceid' in data &&
				data.deviceid === this._eWeLinkConfig.device.deviceid
			) {
				await this._movementExternal.reportMovement(this._movementKey);
			}
		});
		return Promise.resolve();
	}
}
