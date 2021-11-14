import { ModuleMeta } from '../meta';
import { createClient } from './client';
import { initGeocoder } from './geocode';

export const Notion = new (class Meta extends ModuleMeta {
	name = 'notion';

	async init() {
		const client = createClient();
		if (!client) {
			return Promise.resolve();
		}
		await initGeocoder(client);
		return Promise.resolve();
	}
})();
