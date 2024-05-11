import { createExternalClass } from '@server/lib/external';
import { messageHandlerInstance } from '@server/modules/bot/routing';
import { RESPONSE_TYPE } from '@server/modules/bot/types';

export class ExternalHandler extends createExternalClass(true) {
	public async sendMessage(
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
