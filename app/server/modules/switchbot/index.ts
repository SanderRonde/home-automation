import { SwitchbotDeviceBase } from './devices/devices';
import { ExternalHandler } from './external';
import { scanSwitchbots } from './scanner';
import { ModuleMeta } from '../meta';
import { AllModules } from '..';

export const SwitchBot = new (class Meta extends ModuleMeta {
	private _bots: SwitchbotDeviceBase[] = [];
	public name = 'switchbot';

	public get External() {
		return ExternalHandler;
	}

	public init() {
		return Promise.resolve(void 0);
	}

	public async notifyModules(modules: unknown) {
		void (async () => {
			this._bots = await scanSwitchbots(modules as AllModules);
			await ExternalHandler.init(this._bots);
		})();
		return Promise.resolve(void 0);
	}
})();
