import { smarthome } from 'actions-on-google';
import { ModuleConfig, SmartHome } from '..';
import { createRouter } from '../../lib/api';
import { attachMessage } from '../../lib/logger';
import { attachTimerToReq } from '../../lib/timer';
import {
	googleSync,
	googleQuery,
	googleExecute,
	googleDisconnect,
} from './state/google';

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
		await new (
			await SmartHome.modules
		).oauth.External(
			{},
			'SMART_HOME.ROUTING_INIT'
		).getAuthenticateMiddleware(),
		smartHomeApp
	);
	router.use(app, '/actions');
}
