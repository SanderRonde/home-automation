import { EventEmitter } from '../../../../lib/event-emitter';
import type { EwelinkDeviceResponse } from '../../api';
import { AsyncQueue } from '../../../../lib/util';
import type eWelink from 'ewelink-api-next';
import util from 'util';

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

export class EWeLinkWSConnection extends EventEmitter<
	EWeLinkWebSocketMessage<unknown>
> {}

export class EWeLinkSharedConfig {
	public constructor(
		public readonly connection: WrappedEWeLinkAPI,
		public readonly device: EwelinkDeviceResponse,
		public readonly wsConnection: EWeLinkWSConnection,
		public readonly periodicFetcher: EventEmitter<EwelinkDeviceResponse>
	) {}

	public [util.inspect.custom](): string {
		return `${this.constructor.name} { }`;
	}
}

export class WrappedEWeLinkAPI {
	private static readonly WAIT_TIME = 5000;
	private _queue = new AsyncQueue();
	private _lastRequest = Date.now();

	public constructor(
		private readonly _connection: InstanceType<typeof eWelink.WebAPI>
	) {}

	public setThingStatus(
		info: Parameters<
			InstanceType<typeof eWelink.WebAPI>['device']['setThingStatus']
		>[0]
	): Promise<unknown> {
		return this._connection.device.setThingStatus(info);
	}

	public getThingStatus<T>(
		info: Parameters<
			InstanceType<typeof eWelink.WebAPI>['device']['getThingStatus']
		>[0]
	): Promise<T | null> {
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
			return this._connection.device.getThingStatus(info);
		});
	}
}

export abstract class EWeLinkInitable {
	public abstract init(): Promise<void>;
}
