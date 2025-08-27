import { getRoutes } from './routing';
import { ModuleMeta } from '../meta';
import { getKey } from './secret';

export const Auth = new (class Auth extends ModuleMeta {
	public name = 'auth';

	public init() {
		return {
			routes: getRoutes(),
		};
	}

	public getSecretKey(): string {
		return getKey();
	}
})();
