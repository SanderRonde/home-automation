import { registerExitHandler } from '../../../lib/shutdown';
import { AllModules } from '../..';
import TuyAPI from 'tuyapi';

export class TuyaDevice {
	private readonly _device: TuyAPI;
	/**
	 * The tuya API is weird. It'll return an object with shape:
	 * `{dps: {[number]: value}}` where the numbers are seemingly
	 * arbitrarily chosen. However, the lowest number is always the
	 * power value. This is the value we care about.
	 */
	private _lastLowestDigit: number | null = null;
	private _active: boolean | null = null;
	// Not used for now
	// private _connected: boolean = false;

	public constructor(
		private readonly _modules: AllModules,
		private readonly _keyVal: string,
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
			// this._connected = true;
		});

		this._device.on('disconnected', () => {
			// this._connected = false;
		});

		const onChange = async (value: boolean) => {
			if (this._lastLowestDigit === null) {
				return;
			}

			this._active = value;
			await this._device.set({
				set: value,
				dps: this._lastLowestDigit,
			});
		};

		this._device.on('data', async (data) => {
			if (!data.dps) {
				return;
			}

			const numberKeys = Object.keys(data.dps).map((key) =>
				parseInt(key, 10)
			);
			const lowestNumberKey = Math.min(...numberKeys);
			const isEnabled = !!data.dps[lowestNumberKey];
			this._active = isEnabled;
			await new this._modules.keyval.External(
				{},
				'TUYA.DEVICE.STATUS'
			).set(this._keyVal, isEnabled ? '1' : '0', true);

			if (!this._lastLowestDigit !== null) {
				this._lastLowestDigit = lowestNumberKey;
				// Update immediately
				void onChange(isEnabled);
			}
			this._lastLowestDigit = lowestNumberKey;
		});

		void new this._modules.keyval.External({}, 'TUYA.DEVICE.INIT').onChange(
			this._keyVal,
			async (value) => {
				if ((value === '1') !== this._active) {
					await onChange(value === '1');
				}
			}
		);

		registerExitHandler(() => this._device.disconnect());
	}

	public async refresh(): Promise<void> {
		this._device.disconnect();
		await this._device.find();
		await this._device.connect();
	}
}
