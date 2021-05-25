import express = require('express');
import { InfoScreen } from '.';
import { ModuleConfig } from '..';
import { createAPIHandler } from '../../lib/api';
import { logTag } from '../../lib/logger';
import { initMiddleware } from '../../lib/routes';
import { WSClient, WSWrapper } from '../../lib/ws';
import { WebPageHandler } from './web-page';
import { APIHandler } from './api';
import * as http from 'http';
import { authCode, authenticated, authenticateURL } from './calendar';

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

export function initRouting({ config, randomNum }: ModuleConfig): void {
	const app = express();
	const webpageHandler = new WebPageHandler({
		randomNum,
	});
	const apiHandler = new APIHandler();
	const server = http.createServer(app);
	const ws = new WSWrapper(server);

	initMiddleware(app);

	app.all('/', async (req, res) => {
		if (!authenticated) {
			const url = await authenticateURL();
			if (url) {
				res.redirect(url);
				return;
			}
		}

		webpageHandler.index(res, req);
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
		).keyval.external({}, 'INFO_SCREEN.BLANKING').onChange(
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
					).keyval.external({}, 'INFO_SCREEN.BLANKING').get(
						'room.lights.ceiling'
					)) === '0',
			})
		);
		client.onDead(() => {
			listener.remove();
			clients.delete(client);
		});
	});

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
