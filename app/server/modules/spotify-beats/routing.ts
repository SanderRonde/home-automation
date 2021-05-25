import { SpotifyBeats } from '.';
import { ModuleConfig } from '..';
import { createRouter } from '../../lib/api';
import { finishManualAuth } from './spotify/auth';

export function initRouting({ app }: ModuleConfig): void {
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
