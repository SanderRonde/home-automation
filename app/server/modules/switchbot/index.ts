import { SwitchbotDeviceBase } from './devices/devices';
import { ExternalHandler } from './external';
import { scanSwitchbots } from './scanner';
import { ModuleMeta } from '../meta';
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
