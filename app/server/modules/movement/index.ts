import { ResDummy } from '../../lib/logging/response-logger';
import { disable, enable, initRegister } from './register';
import { LogObj } from '../../lib/logging/lob-obj';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';

export const Movement = new (class Movement extends ModuleMeta {
	public name = 'movement';

	public init(config: ModuleConfig<Movement>) {
		initRegister(config.db);
		initRouting(config);

		config.modules.keyval.onChange(
			LogObj.fromEvent('MOVEMENT.NOTIFY'),
			'state.movement',
			async (value) => {
				if (value === '1') {
					await enable();
				} else {
					await disable();
				}
			},
			{ notifyOnInitial: true }
		);
	}

	public async reportMovement(key: string, logObj: LogObj): Promise<void> {
		const resDummy = new ResDummy();
		await APIHandler.reportMovement(resDummy, {
			key,
			auth: (await this.modules).auth.getSecretKey(),
		});
		LogObj.fromRes(resDummy).transferTo(logObj);
	}
})();
