import {
	googleSync,
	googleQuery,
	googleExecute,
	googleDisconnect,
} from './state/google';
import { createSamsungSchemaHandler } from './state/samsung';
import { attachTimerToReq } from '../../lib/timer';
import { attachMessage } from '../../lib/logger';
import { smarthome } from 'actions-on-google';
import { ModuleConfig, SmartHome } from '..';
import { createRouter } from '../../lib/api';

export async function initRouting({ app }: ModuleConfig): Promise<void> {
	const smartHomeApp = smarthome({});

	smartHomeApp.onSync(googleSync);
	smartHomeApp.onQuery(googleQuery);
	smartHomeApp.onExecute(googleExecute);
	smartHomeApp.onDisconnect(googleDisconnect);

	const router = createRouter(SmartHome, {});
	router.all(
		'/google',
		(req, res, next) => {
			const intent = (
				req.body as {
					inputs: {
						intent: string;
					}[];
				}
			).inputs[0].intent;
			attachMessage(res, `Intent: ${intent}`);
			attachTimerToReq(res);
			return next();
		},
		// @ts-ignore
		await new (
			await SmartHome.modules
		).oauth.External(
			{},
			'SMART_HOME.ROUTING_INIT'
		).getAuthenticateMiddleware(),
		smartHomeApp
	);

	const handler = createSamsungSchemaHandler();
	if (handler) {
		router.post('/samsung', (req, res) =>
			handler.handleHttpCallback(req, res)
		);
	}
	router.use(app, '/actions');
}
