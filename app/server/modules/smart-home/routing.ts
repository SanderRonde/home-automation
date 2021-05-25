import { smarthome } from 'actions-on-google';
import { ModuleConfig, SmartHome } from '..';
import { createRouter } from '../../lib/api';
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
