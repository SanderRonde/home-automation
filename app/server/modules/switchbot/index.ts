import { SwitchbotDeviceBase } from '@server/modules/switchbot/devices/devices';
import { ExternalHandler } from '@server/modules/switchbot/external';
import { scanSwitchbots } from '@server/modules/switchbot/scanner';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

export const SwitchBot = new (class SwitchBot extends ModuleMeta {
	private _bots: SwitchbotDeviceBase[] = [];
	public name = 'switchbot';

	public get External() {
		return ExternalHandler;
	}

	public init({ modules }: ModuleConfig<SwitchBot>) {
		void (async () => {
			this._bots = await scanSwitchbots(modules);
			await ExternalHandler.init(this._bots);
		})();
	}
})();
