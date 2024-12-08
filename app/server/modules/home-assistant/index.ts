import { ExternalHandler } from './external';
import { HomeAssistantAPI } from './api';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';

export const HomeAssistant = new (class HomeAssistant extends ModuleMeta {
	public name = 'homeAssistant';

	public get External() {
		return ExternalHandler;
	}

	public init() {
		if (!getEnv('SECRET_HASS_TOKEN') || !getEnv('SECRET_HASS_HOST')) {
			void ExternalHandler.init({ api: null });
			return;
		}

		const port = getEnv('SECRET_HASS_PORT', false);
		const api = new HomeAssistantAPI({
			host: getEnv('SECRET_HASS_HOST', true),
			token: getEnv('SECRET_HASS_TOKEN', true),
			port: port ? parseInt(port, 10) : undefined,
		});
		void ExternalHandler.init({ api });
	}
})();
