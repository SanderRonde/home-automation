import { AppWrapper, ResponseDummy } from '../lib/routes';
import { transferAttached } from '../lib/logger';

export function initMultiRoutes(app: AppWrapper) {
	app.app.post('/multi', async (req, res) => {
		const { requests } = req.body as {
			requests: {
				path: string;
				body: {
					[key: string]: string;
				}
				method: string;
			}[];
		};
		if (!requests || !Array.isArray(requests)) {
			res.status(400).write('No routes given');
			res.end();
			return;
		}

		// Validate them all
		for (const route of requests) {
			if (typeof route !== 'object' || !route.path || typeof route.path !== 'string' ||
				!route.body || typeof route.body !== 'object') {
					res.status(400).write('Invalid route format. Expected is { method: string, path: string, body: {} }');
					res.end();
					return;
				}
		}

		const resDummy = new ResponseDummy(res)
		for (const { body, path, method } of requests) {
			await app.triggerRoute(req, resDummy, method, path, body);
		}
		transferAttached(resDummy, res);
		resDummy.apply();
	});
}