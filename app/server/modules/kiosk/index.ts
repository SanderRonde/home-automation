import { initRouting } from './routing';
import { refresh } from './calendar';
import { ModuleMeta } from '../meta';

export const Kiosk = new (class Kiosk extends ModuleMeta {
	public name = 'kiosk';

	public setup!: Promise<void>;

	public async init() {
		await refresh();

		return {
			serve: initRouting(),
		};
	}
})();
