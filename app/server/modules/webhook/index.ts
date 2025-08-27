import { initRouting } from './routing';
import { ModuleMeta } from '../meta';

export const Webhook = new (class Webhook extends ModuleMeta {
	public name = 'webhook';

	public init() {
		return {
			routes: initRouting(),
		};
	}
})();
