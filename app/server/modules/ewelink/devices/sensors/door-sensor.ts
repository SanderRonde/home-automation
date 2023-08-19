import {
	EWeLinkInitable,
	EWeLinkSharedConfig,
	EWeLinkWebSocketMessage,
} from '../shared';
import { logTag } from '../../../../lib/logger';

export class EwelinkDoorSensor extends EWeLinkInitable {
	public constructor(
		private readonly _eWeLinkConfig: EWeLinkSharedConfig,
		private readonly _name: string,
		private readonly _callback: (isClosed: boolean) => void | Promise<void>
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
					lock: 0 | 1;
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
						this._eWeLinkConfig.device.itemData.deviceid
				) {
					const isClosed = data.params.lock === 0;
					logTag(
						'ewelink',
						'cyan',
						`Door ${isClosed ? 'closed' : 'opened'}:`,
						this._name
					);
					await this._callback(isClosed);
				}
			}
		);
		return Promise.resolve();
	}
}
