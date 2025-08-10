import type { EWeLinkSharedConfig, EWeLinkWebSocketMessage } from '../shared';
import { LogObj } from '../../../../../lib/logging/lob-obj';
import { logTag } from '../../../../../lib/logging/logger';
import { EWeLinkInitable } from '../shared';

export class EwelinkMovement extends EWeLinkInitable {
	public constructor(
		private readonly _eWeLinkConfig: EWeLinkSharedConfig,
		private readonly _movementKey: string
	) {
		super();
	}

	public init(): Promise<void> {
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
					await this._eWeLinkConfig.modules.movement.reportMovement(
						this._movementKey,
						LogObj.fromEvent('EWELINK.MOVEMENT.INIT')
					);
				}
			}
		);
		return Promise.resolve();
	}
}
