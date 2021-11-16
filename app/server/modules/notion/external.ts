import { Client } from '@notionhq/client';
import { createExternalClass } from '../../lib/external';

export class ExternalHandler extends createExternalClass(true) {
	private static _client: Client | null = null;

	async getClient(): Promise<Client> {
		return this.runRequest(() => {
			return ExternalHandler._client!;
		});
	}

	static init(client: Client): Promise<void> {
		this._client = client;
		return super.init();
	}
}
