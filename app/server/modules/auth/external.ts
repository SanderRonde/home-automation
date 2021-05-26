import { createExternalClass } from '../../lib/external';
import { authenticate, getKey } from './secret';

export class ExternalHandler extends createExternalClass(false) {
	async getSecretKey(): Promise<string> {
		return this.runRequest(() => {
			return getKey();
		});
	}

	async authenticate(message: string): Promise<boolean> {
		return this.runRequest(() => {
			return authenticate(message);
		});
	}
}
