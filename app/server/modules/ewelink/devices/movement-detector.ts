import { ExternalHandler } from '../../movement/external';
import { EWeLinkSharedConfig } from './shared';

export class EwelinkMovement {
	private _movementExternal!: ExternalHandler;

	constructor(
		private _eWeLinkConfig: EWeLinkSharedConfig,
		private _movementKey: string
	) {}

	init(): void {
		this._movementExternal =
			new this._eWeLinkConfig.modules.movement.External(
				{},
				'EWELINK.MOVEMENT.INIT'
			);
		this._eWeLinkConfig.wsConnection.on('data', async (data) => {
			if (
				'deviceid' in data &&
				data.deviceid === this._eWeLinkConfig.device.deviceid
			) {
				await this._movementExternal.reportMovement(this._movementKey);
			}
		});
	}
}
