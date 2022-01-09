import express = require('express');
import { authCode, authenticated, authenticateURL } from './calendar';
import { initMiddleware, initPostRoutes } from '../../lib/routes';
import { AsyncExpressApplication } from '../../types/express';
import { WSClient, WSWrapper } from '../../lib/ws';
import { createAPIHandler } from '../../lib/api';
import { WebPageHandler } from './web-page';
import { logTag } from '../../lib/logger';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
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

export function initRouting(moduleConfig: ModuleConfig): void {
	const { config, randomNum } = moduleConfig;
	const app = express() as AsyncExpressApplication;
	const webpageHandler = new WebPageHandler({
		randomNum,
	});
	const apiHandler = new APIHandler();
	const server = http.createServer(app as express.Application);
	const ws = new WSWrapper(server);

	initMiddleware({
		...moduleConfig,
		app,
	});

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
		createAPIHandler(InfoScreen, apiHandler.getTemperature.bind(apiHandler))
	);

	app.post(
		'/calendar',
		createAPIHandler(InfoScreen, apiHandler.getEvents.bind(apiHandler))
	);

	ws.all('/blanking', async (client) => {
		clients.add(client);
		const listener = await new (
			await InfoScreen.modules
		).keyval.External({}, 'INFO_SCREEN.BLANKING').onChange(
			'room.lights.ceiling',
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
					(await new (
						await InfoScreen.modules
					).keyval.External({}, 'INFO_SCREEN.BLANKING').get(
						'room.lights.ceiling'
					)) === '0',
			})
		);
		client.onDead(() => {
			listener.remove();
			clients.delete(client);
		});
	});

	initPostRoutes(app as express.Express);

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
