import { createExternalClass } from '../../lib/external';
import { messageHandlerInstance } from './routing';
import { RESPONSE_TYPE } from './types';

export class ExternalHandler extends createExternalClass(true) {
	async sendMessage(
		text: string,
		type: RESPONSE_TYPE,
		chatID?: number
	): Promise<boolean> {
		return this.runRequest(async () => {
			return (await messageHandlerInstance.value).sendMessage(
				text,
				type,
				chatID
			);
		});
	}
}
