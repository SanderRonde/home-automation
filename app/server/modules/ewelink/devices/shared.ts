import EventEmitter from 'events';
import eWelink, { Device } from 'ewelink-api';
import { AllModules } from '../..';

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
	on(
		event: 'data',
		listener: (data: EWeLinkWebSocketMessage<unknown>) => void
	): this {
		return super.on(event, listener);
	}
}

export interface EWeLinkSharedConfig {
	connection: eWelink;
	device: Device;
	wsConnection: EWeLinkWSConnection;
	modules: AllModules;
}

export abstract class EWeLinkInittable {
	public abstract init(): Promise<void>;
}
