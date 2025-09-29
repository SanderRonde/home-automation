import { SettablePromise } from '../../lib/settable-promise';
import { UserManagement } from './user-management';
import type { ModuleConfig } from '..';
import { getRoutes } from './routing';
import { ModuleMeta } from '../meta';
import { getKey } from './secret';

export const Auth = new (class Auth extends ModuleMeta {
	public name = 'auth';
	private _userManagement = new SettablePromise<UserManagement>();

	public async init(config: ModuleConfig) {
		const userManagement = new UserManagement(config.sqlDB);
		await userManagement.init();
		this._userManagement.set(userManagement);

		return {
			serve: await getRoutes(userManagement),
		};
	}

	public getSecretKey(): string {
		return getKey();
	}

	public get userManagement(): Promise<UserManagement> {
		return this._userManagement.value;
	}
})();
