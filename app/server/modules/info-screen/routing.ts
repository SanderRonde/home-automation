import express = require('express');
import { authCode, authenticated, authenticateURL } from './calendar';
import type { AsyncExpressApplication } from '../../types/express';
import { initMiddleware, initPostRoutes } from '../../lib/routes';
import { LogObj } from '../../lib/logging/lob-obj';
import { logTag } from '../../lib/logging/logger';
import { createAPIHandler } from '../../lib/api';
import type { WSClient } from '../../lib/ws';
import { WebPageHandler } from './web-page';
import { WSWrapper } from '../../lib/ws';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import { APIHandler } from './api';
import { InfoScreen } from '.';
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
	const ws = new WSWrapper(server);

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

	ws.all('/blanking', async (client) => {
		clients.add(client);

		if (getEnv('INFO_SCREEN_KEYVAL', false)) {
			const listener = (await InfoScreen.modules).keyval.onChange(
				LogObj.fromEvent('INFO_SCREEN.BLANKING'),
				getEnv('INFO_SCREEN_KEYVAL', true),
				(value) => {
					client.send(
						JSON.stringify({
							blank: value === '0',
						})
					);
				},
				{ notifyOnInitial: true }
			);
			client.send(
				JSON.stringify({
					blank:
						(await (
							await InfoScreen.modules
						).keyval.get(
							LogObj.fromEvent('INFO_SCREEN.BLANKING'),
							getEnv('INFO_SCREEN_KEYVAL', true)
						)) === '0',
				})
			);
			client.onDead(() => {
				listener.remove();
				clients.delete(client);
			});
		} else {
			client.onDead(() => {
				clients.delete(client);
			});
		}
	});

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
