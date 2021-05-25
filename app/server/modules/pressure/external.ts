import { createExternalClass } from '../../lib/external';
import { attachMessage } from '../../lib/logger';
import { disable, enable, getPressure, isEnabled } from './register';

export class ExternalHandler extends createExternalClass(false) {
	async enable(): Promise<void> {
		return this.runRequest(async (_res, _source, logObj) => {
			await enable();
			attachMessage(logObj, 'Enabled pressure module');
		});
	}

	async disable(): Promise<void> {
		return this.runRequest(async (_res, _source, logObj) => {
			await disable();
			attachMessage(logObj, 'Disabled pressure module');
		});
	}

	async isEnabled(): Promise<boolean> {
		return this.runRequest((_res, _source, logObj) => {
			const enabled = isEnabled();
			attachMessage(logObj, 'Got enabled status of pressure module');
			return enabled;
		});
	}

	async get(key: string): Promise<number | null> {
		return this.runRequest((_res, _source, logObj) => {
			const pressure = getPressure(key);
			attachMessage(
				logObj,
				`Returning pressure ${String(pressure)} for key ${key}`
			);
			return pressure;
		});
	}
}
