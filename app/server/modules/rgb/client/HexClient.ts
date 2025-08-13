import type { LED_NAME } from '../../../config/led-config';
import type { BuiltinPatterns } from 'magic-home';
import { Color } from '../../../lib/color';
import { RGBClient } from './RGBClient';
import { XHR } from '../../../lib/xhr';

export class HexClient extends RGBClient {
	public setWhiteForPower = false;

	public constructor(
		public address: string,
		public id: LED_NAME
	) {
		super();
	}

	private _numToHex(num: number) {
		const hexed = Math.round(num).toString(16);
		if (hexed.length === 1) {
			return `${hexed}0`;
		}
		return hexed;
	}

	private _colorToHex(color: Color) {
		return `#${this._numToHex(color.r)}${this._numToHex(
			color.g
		)}${this._numToHex(color.b)}`;
	}

	public isOn(): Promise<boolean> {
		const assumedState = this._lastState.type !== 'off';
		void (async () => {
			const response = (await XHR.post(
				`http://${this.address}/is_on`,
				`hex-${this.address}-is-on`
			)) as null | EncodedString<{ enabled: boolean }>;
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

	public async setColor(
		red: number,
		green: number,
		blue: number
	): Promise<boolean> {
		return this.setColorWithBrightness(
			red,
			green,
			blue,
			(await this.getBrightness()) || 100
		);
	}

	public async setBrightness(brightness: number): Promise<boolean> {
		const color =
			this._lastState.type === 'fullColor'
				? this._lastState.color
				: new Color(255);
		return this.setColorWithBrightness(
			color.r,
			color.g,
			color.b,
			brightness * 100
		);
	}

	public async setColorAndWarmWhite(
		red: number,
		green: number,
		blue: number,
		ww: number
	): Promise<boolean> {
		return this.setColorWithBrightness(red, green, blue, ww);
	}

	public async setColorWithBrightness(
		red: number,
		green: number,
		blue: number,
		brightness: number
	): Promise<boolean> {
		await XHR.post(
			`http://${this.address}/set_all`,
			`hex-${this.address}-color-with-brightness`,
			{
				color: this._colorToHex(
					new Color(
						red * (brightness / 100),
						green * (brightness / 100),
						blue * (brightness / 100)
					)
				),
			}
		);
		this.updateStateColor(new Color(red, green, blue), brightness);
		return Promise.resolve(true);
	}

	public async setPattern(pattern: BuiltinPatterns): Promise<boolean> {
		await XHR.post(
			`http://${this.address}/effects/${pattern}`,
			`hex-${this.address}-pattern`
		);
		this.updateStateEffect(pattern);
		return Promise.resolve(true);
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

	public async setWarmWhite(): Promise<boolean> {
		return this.setColorWithBrightness(255, 255, 255, 100);
	}
	public async turnOff(): Promise<boolean> {
		await XHR.post(`http://${this.address}/off`, `hex-${this.address}-off`);
		await this._turnedOff();
		return Promise.resolve(true);
	}
	public async turnOn(): Promise<boolean> {
		await XHR.post(`http://${this.address}/on`, `hex-${this.address}-on`);
		await this._turnedOn();
		return Promise.resolve(true);
	}

	public async runEffect(
		name: string,
		params: Record<string, string>
	): Promise<boolean> {
		await XHR.post(
			`http://${this.address}/effects/${name}`,
			`hex-${this.address}-effect-${name}`,
			params
		);
		this.updateStateEffect(name);
		return Promise.resolve(true);
	}
}
