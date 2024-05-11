import { LED_NAME } from '../../../config/led-config';
import { LedEffect } from '../effect-config';
import { Color } from '../../../lib/color';
import { XHR } from '../../../lib/util';
import { RGBClient } from './RGBClient';

export class RingClient extends RGBClient {
	public setWhiteForPower = false;

	public constructor(
		public address: string,
		public id: LED_NAME,
		public numLeds: number
	) {
		super();
	}

	public async isOn(): Promise<boolean> {
		const assumedState = this._lastState.type !== 'off';
		void (async () => {
			const response = (await XHR.post(
				`http://${this.address}/is_on`,
				`ring-${this.address}-is-on`
			)) as EncodedString<{ enabled: boolean }>;
			if (!response) {
				return;
			}
			const isEnabled = JSON.parse(response).enabled;

			if (assumedState !== isEnabled) {
				this._updateStatePower(isEnabled);
			}
		})();
		return Promise.resolve(assumedState);
	}

	public async getColor(): Promise<Color | null> {
		if (this._lastState.type === 'fullColor') {
			return Promise.resolve(this._lastState.color);
		}
		return Promise.resolve(null);
	}

	public setColor(): Promise<boolean> {
		throw new Error('Not implemented');
	}

	public setBrightness(): Promise<boolean> {
		throw new Error('Not implemented');
	}

	public setColorAndWarmWhite(): Promise<boolean> {
		throw new Error('Not implemented');
	}

	public setColorWithBrightness(): Promise<boolean> {
		throw new Error('Not implemented');
	}

	public setPattern(): Promise<boolean> {
		throw new Error('Not implemented');
	}

	public setPreset(): Promise<boolean> {
		throw new Error('Method not implemented.');
	}

	public async setPower(on: boolean): Promise<boolean> {
		if (on) {
			await this._turnedOn();
			await this.turnOn();
		} else {
			await this._turnedOff();
			await this.turnOff();
		}
		return Promise.resolve(true);
	}

	public setWarmWhite(): Promise<boolean> {
		throw new Error('Not implemented');
	}

	public async turnOff(): Promise<boolean> {
		await XHR.post(
			`http://${this.address}/off`,
			`ring-${this.address}-off`
		);
		await this._turnedOn();
		return Promise.resolve(true);
	}

	public async turnOn(): Promise<boolean> {
		await XHR.post(`http://${this.address}/on`, `ring-${this.address}-on`);
		await this._turnedOn();
		return Promise.resolve(true);
	}

	public async runEffect(
		effect: LedEffect,
		effectName: string
	): Promise<boolean> {
		await XHR.post(
			`http://${this.address}/effects/steps`,
			`ring-${this.address}-effect`,
			{
				data: JSON.stringify(effect.toJSON()),
			}
		);
		this.updateStateEffect(effectName);
		return Promise.resolve(true);
	}
}
