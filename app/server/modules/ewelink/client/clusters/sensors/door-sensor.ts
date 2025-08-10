import type { EWeLinkSharedConfig, EWeLinkWebSocketMessage } from '../shared';
import { logTag } from '../../../../../lib/logging/logger';
import { EWeLinkInitable } from '../shared';

export class EwelinkDoorSensor extends EWeLinkInitable {
	public constructor(
		private readonly _eWeLinkConfig: EWeLinkSharedConfig,
		private readonly _name: string,
		private readonly _callback: (
			state: 'opened' | 'closed'
		) => void | Promise<void>
	) {
		super();
	}

	public init(): Promise<void> {
		this._eWeLinkConfig.wsConnection.on(
			'data',
			async (
				data: EWeLinkWebSocketMessage<{
					/**
					 * 0=closed, 1=open
					 */
					lock?: 0 | 1;
					/**
					 * Stringified number of milliseconds since epoch
					 */
					trigTime: string;
				}>
			) => {
				if (
					typeof data === 'object' &&
					'deviceid' in data &&
					data.deviceid ===
						this._eWeLinkConfig.device.itemData.deviceid &&
					'lock' in data.params
				) {
					const isClosed = data.params.lock === 0;
					const state = isClosed ? 'closed' : 'opened';
					logTag('ewelink', 'cyan', `Door ${state}:`, this._name);
					await this._callback(state);
				}
			}
		);
		return Promise.resolve();
	}
}
