import express = require('express');
import { authCode, authenticated, authenticateURL } from './calendar';
import type { AsyncExpressApplication } from '../../types/express';
import { initMiddleware, initPostRoutes } from '../../lib/routes';
import { logTag } from '../../lib/logging/logger';
import { createAPIHandler } from '../../lib/api';
import type { WSClient } from '../../lib/ws';
import { WebPageHandler } from './web-page';
import type { ModuleConfig } from '..';
import type { InfoScreen } from '.';
import { APIHandler } from './api';
import * as http from 'http';

const clients: Set<WSClient> = new Set();

export function refreshClients(): number {
	clients.forEach((client) => {
		client.send(
			JSON.stringify({
				refresh: true,
			})
		);
	});
	return clients.size;
}

export function initRouting(
	moduleConfig: ModuleConfig<typeof InfoScreen>
): void {
	const { config, randomNum } = moduleConfig;
	const app = express() as AsyncExpressApplication;
	const webpageHandler = new WebPageHandler({
		randomNum,
	});
	const apiHandler = new APIHandler();
	const server = http.createServer(app as express.Application);

	initMiddleware(app);

	app.all('/', async (_req, res) => {
		if (!authenticated) {
			const url = await authenticateURL();
			if (url) {
				res.redirect(url);
				return;
			}
		}

		webpageHandler.index(res);
	});
	app.get('/authorize', async (req, res) => {
		const getParams = req.query as {
			code?: string;
		};
		const code = getParams['code'];
		if (code) {
			await authCode(code);
		}

		res.redirect('/');
	});

	app.post(
		'/weather',
		createAPIHandler(apiHandler.getTemperature.bind(apiHandler))
	);

	app.post(
		'/calendar',
		createAPIHandler(apiHandler.getEvents.bind(apiHandler))
	);

	initPostRoutes({ app: app as express.Express, config });

	if (config.debug) {
		server.listen(config.ports.info, () => {
			logTag(
				'info-screen',
				'magenta',
				`server listening on port ${config.ports.info}`
			);
		});
	} else {
		server.listen(config.ports.info, '127.0.0.1', () => {
			logTag(
				'info-screen',
				'magenta',
				`server listening on port ${config.ports.info} on localhost only`
			);
		});
	}
}
