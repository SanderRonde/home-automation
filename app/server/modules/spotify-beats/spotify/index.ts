import { logTag } from '@server/lib/logger';
import { Database } from '@server/lib/db';
import { createSpotifyAPI } from '@server/modules/spotify-beats/spotify/api';

export async function initSpotify(db: Database): Promise<void> {
	const api = createSpotifyAPI(db);
	if (!api) {
		return;
	}

	const token = db.get('token', 'default');
	const refresh = db.get('refresh', 'default');
	api.setToken(token);
	api.setRefresh(refresh, 100000);

	// Test it
	if (await api.testAuth()) {
		logTag('spotify', 'cyan', 'Authenticated');
	} else {
		logTag('spotify', 'cyan', 'Not Authenticated');
	}
}
