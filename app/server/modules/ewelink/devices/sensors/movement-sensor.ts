import type { EWeLinkSharedConfig, EWeLinkWebSocketMessage } from '../shared';
import type { ExternalHandler } from '../../../movement/external';
import { LogObj } from '../../../../lib/logging/lob-obj';
import { logTag } from '../../../../lib/logging/logger';
import { EWeLinkInitable } from '../shared';

export class EwelinkMovement extends EWeLinkInitable {
	private _movementExternal!: ExternalHandler;

	public constructor(
		private readonly _eWeLinkConfig: EWeLinkSharedConfig,
		private readonly _movementKey: string
	) {
		super();
	}

	public init(): Promise<void> {
		this._movementExternal =
			new this._eWeLinkConfig.modules.movement.External(
				LogObj.fromEvent('EWELINK.MOVEMENT.INIT')
			);
		this._eWeLinkConfig.wsConnection.on(
			'data',
			async (data: EWeLinkWebSocketMessage<{ online: boolean }>) => {
				if (
					typeof data === 'object' &&
					'deviceid' in data &&
					data.deviceid ===
						this._eWeLinkConfig.device.itemData.deviceid &&
					data.params.online
				) {
					logTag('ewelink', 'cyan', 'Movement:', this._movementKey);
					await this._movementExternal.reportMovement(
						this._movementKey
					);
				}
			}
		);
		return Promise.resolve();
	}
}
