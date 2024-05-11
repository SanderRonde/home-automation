import { initRouting } from '@server/modules/info-screen/routing';
import { refresh } from '@server/modules/info-screen/calendar';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/info-screen/bot';

export const InfoScreen = new (class InfoScreen extends ModuleMeta {
	public name = 'info-screen';

	public setup!: Promise<void>;

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig<InfoScreen>) {
		initRouting(config);
		await refresh();
	}
})();
