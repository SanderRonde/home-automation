import { registerExitHandler } from '../../../lib/shutdown';
import { AllModules } from '../..';
import TuyAPI from 'tuyapi';

export class TuyaDevice {
	private readonly _device: TuyAPI;
	protected _connected: boolean = false;

	public constructor(
		protected readonly _modules: AllModules,
		id: string,
		key: string
	) {
		this._device = new TuyAPI({
			id,
			key,
			issueGetOnConnect: true,
			issueRefreshOnConnect: true,
			issueRefreshOnPing: true,
		});

		void this._device.find().then(() => {
			void this._device.connect();
		});

		this._device.on('connected', () => {
			this._connected = true;
		});

		this._device.on('disconnected', () => {
			this._connected = false;
		});

		this._device.on('data', (data) => {
			console.log('tuyadata=', data);
		});

		registerExitHandler(() => this._device.disconnect());
	}

	public async refresh(): Promise<void> {
		this._device.disconnect();
		await this._device.find();
		await this._device.connect();
	}
}
