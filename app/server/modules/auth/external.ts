import { createExternalClass } from '@server/lib/external';
import { authenticate, getKey } from '@server/modules/auth/secret';

export class ExternalHandler extends createExternalClass(false) {
	public async getSecretKey(): Promise<string> {
		return this.runRequest(() => {
			return getKey();
		});
	}

	public async authenticate(message: string): Promise<boolean> {
		return this.runRequest(() => {
			return authenticate(message);
		});
	}
}
