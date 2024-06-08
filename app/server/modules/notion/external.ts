import { createExternalClass } from '../../lib/external';
import type { Client } from '@notionhq/client';

export class ExternalHandler extends createExternalClass(true) {
	private static _client: Client | null = null;

	public static init(client: Client): Promise<void> {
		this._client = client;
		return super.init();
	}

	public async getClient(): Promise<Client> {
		return this.runRequest(() => {
			return ExternalHandler._client!;
		});
	}
}
