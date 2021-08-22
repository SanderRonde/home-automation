import EventEmitter from 'events';
import eWelink, { Device } from 'ewelink-api';
import { AllModules } from '../..';

export type EWeLinkWebSocketMessage =
	| ({
			action: 'update';
	  } & {
			deviceid: string;
			apikey: string;
			userAgent: string;
			d_seq: number;
			params: Record<string, string | number>;
			from: string;
	  })
	| {
			error: number;
			apikey: string;
			config: Record<string, string | number>;
			sequence: string;
	  }
	| 'pong';

export class EWeLinkWSConnection extends EventEmitter {
	on(event: 'data', listener: (data: EWeLinkWebSocketMessage) => void): this {
		return super.on(event, listener);
	}
}

export interface EWeLinkSharedConfig {
	connection: eWelink;
	device: Device;
	wsConnection: EWeLinkWSConnection;
	modules: AllModules;
}
