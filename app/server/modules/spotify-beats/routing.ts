import { finishManualAuth } from './spotify/auth';
import { createRouter } from '../../lib/api';
import type { ModuleConfig } from '..';
import { SpotifyBeats } from '.';

export function initRouting({ app }: ModuleConfig<typeof SpotifyBeats>): void {
	const router = createRouter(SpotifyBeats, {});
	router.post('/redirect', async (req, res) => {
		const getParams = req.query as {
			code?: string;
		};
		const code = getParams['code'];
		if (code) {
			await finishManualAuth(code);
		}

		res.write('Done!');
		res.status(200);
		res.end();
	});
	router.use(app, '/spotify');
}
