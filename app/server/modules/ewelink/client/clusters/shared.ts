import type { thingInfo as setThingStatusInfo } from 'ewelink-api-next/dist/web/apis/device/setThingStatus';
import type { thingInfo as getThingStatusInfo } from 'ewelink-api-next/dist/web/apis/device/getThingStatus';
import type eWelink from '../../../../../temp/ewelink-api-next';
import type { EwelinkDeviceResponse } from '../../api';
import { AsyncQueue } from '../../../../lib/util';
import type { AllModules } from '../../..';
import EventEmitter from 'events';

export type EWeLinkUpdateMessage<P = Record<string, string | number>> = {
	action: 'update';
	deviceid: string;
	apikey: string;
	userAgent: string;
	d_seq: number;
	params: P;
	from: string;
};

export type EWeLinkWebSocketMessage<P = Record<string, string | number>> =
	| EWeLinkUpdateMessage<P>
	| {
			error: number;
			apikey: string;
			config: P;
			sequence: string;
	  }
	| 'pong';

export class EWeLinkWSConnection extends EventEmitter {
	public on(
		event: 'data',
		listener: (
			data: EWeLinkWebSocketMessage<unknown>
		) => void | Promise<void>
	): this {
		return super.on(event, (data) => void listener(data));
	}
}

export interface EWeLinkSharedConfig {
	connection: WrappedEWeLinkAPI;
	device: EwelinkDeviceResponse;
	wsConnection: EWeLinkWSConnection;
	modules: AllModules;
}

export class WrappedEWeLinkAPI {
	private static readonly WAIT_TIME = 5000;
	private _queue = new AsyncQueue();
	private _lastRequest = Date.now();

	public constructor(
		private readonly _connection: InstanceType<typeof eWelink.WebAPI>
	) {}

	public setThingStatus(info: setThingStatusInfo): Promise<unknown> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return this._connection.device.setThingStatus(info);
	}

	public getThingStatus<T>(info: getThingStatusInfo): Promise<T | null> {
		if (!this._queue.isEmpty()) {
			return Promise.resolve(null);
		}
		return this._queue.addItem(async () => {
			const now = Date.now();
			if (now - this._lastRequest < WrappedEWeLinkAPI.WAIT_TIME) {
				await new Promise((resolve) =>
					setTimeout(
						resolve,
						WrappedEWeLinkAPI.WAIT_TIME - (now - this._lastRequest)
					)
				);
			}
			this._lastRequest = Date.now();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			return this._connection.device.getThingStatus(info);
		});
	}
}

export abstract class EWeLinkInitable {
	public abstract init(): Promise<void>;
}
