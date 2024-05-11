import { registerExitHandler } from '@server/lib/shutdown';
import { AllModules } from '@server/modules';
import TuyAPI from 'tuyapi';

export class TuyaDevice {
	private readonly _device: TuyAPI;
	/**
	 * The tuya API is weird. It'll return an object with shape:
	 * `{dps: {[number]: value}}` where the numbers are seemingly
	 * arbitrarily chosen. However, the lowest number is always the
	 * power value. This is the value we care about.
	 */
	private _lastLowestDigit: number = 20;
	private _active: boolean | null = null;

	public constructor(
		private readonly _modules: AllModules,
		private readonly _keyval: string,
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

		void this._device
			.find({
				all: false,
			})
			.then(() => {
				void this._device.connect();
			});
		const onChange = async (value: boolean) => {
			if (!this._device.isConnected()) {
				await this._device.connect();
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
			).set(this._keyval, isEnabled ? '1' : '0', true);

			this._lastLowestDigit = lowestNumberKey;
		});

		void new this._modules.keyval.External({}, 'TUYA.DEVICE.INIT').onChange(
			this._keyval,
			async (value) => {
				if ((value === '1') !== this._active) {
					await onChange(value === '1');
				}
			}
		);

		const interval = setInterval(() => {
			if (this._lastLowestDigit) {
				void this._device.refresh({
					dps: this._lastLowestDigit,
				});
			}
		}, 1000 * 60);
		registerExitHandler(() => {
			this._device.disconnect();
			clearTimeout(interval);
		});
	}

	public async refresh(): Promise<void> {
		this._device.disconnect();
		await this._device.find();
		await this._device.connect();
	}
}
