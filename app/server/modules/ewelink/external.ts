import { createExternalClass } from '../../lib/external';

export class ExternalHandler extends createExternalClass(false) {
	// async getSecretKey(): Promise<string> {
	// 	return this.runRequest(() => {
	// 		return getKey();
	// 	});
	// }
	// async authenticate(message: string): Promise<boolean> {
	// 	return this.runRequest(() => {
	// 		return authenticate(message);
	// 	});
	// }
}
