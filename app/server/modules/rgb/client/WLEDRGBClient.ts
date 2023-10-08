import { LED_NAMES_ENUM } from '../../../config/led-config';
import { Color } from '../../../lib/color';
import { WLEDClient } from 'wled-client';
import { RGBClient } from './RGBClient';

export class WLEDRGBClient extends RGBClient {
	private readonly _client: WLEDClient;
	public setWhiteForPower = false;

	public constructor(
		public address: string,
		public readonly id: LED_NAMES_ENUM
	) {
		super();
		this._client = new WLEDClient(address);
		void this._client.init();
	}

	public setPattern(): Promise<boolean> {
		throw new Error('Method not implemented.');
	}

	public async setPreset(preset: number): Promise<boolean> {
		await this._client.setPreset(preset);
		await this.turnOn();
		return Promise.resolve(true);
	}

	public isOn(): Promise<boolean> {
		return Promise.resolve(this._client.state.on ?? false);
	}

	public getColor(): Promise<Color | null> {
		const firstColor = this._client.state.segments?.[0].colors?.[0];
		return Promise.resolve(
			firstColor
				? new Color(firstColor[0], firstColor[1], firstColor[2])
				: null
		);
	}

	public async getBrightness(): Promise<number | null> {
		return Promise.resolve(this._client.state.brightness ?? null);
	}

	public async setColor(
		red: number,
		green: number,
		blue: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		await this._client.setColor([red, green, blue], {
			method: 'ws',
		});
		await this.turnOn();
		callback?.(null, true);
		return Promise.resolve(true);
	}

	public async setBrightness(brightness: number): Promise<boolean> {
		await this._client.setBrightness(Math.round(brightness * 255));
		await this.turnOn();
		return Promise.resolve(true);
	}

	public async setColorAndWarmWhite(
		red: number,
		green: number,
		blue: number,
		ww: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		await this._client.setColor([red, green, blue, ww], {
			method: 'ws',
		});
		await this.turnOn();
		callback?.(null, true);
		return Promise.resolve(true);
	}

	public async setColorWithBrightness(
		red: number,
		green: number,
		blue: number,
		brightness: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		await this._client.updateState({
			on: true,
			brightness: Math.round(brightness * 255),
			segments: [
				{
					colors: [[red, green, blue]],
				},
			],
		});
		await this.turnOn();
		callback?.(null, true);
		return Promise.resolve(true);
	}

	public async setPower(
		on: boolean,
		callback?: () => void
	): Promise<boolean> {
		if (on) {
			await this._turnedOn();
			return this.turnOn(callback);
		} else {
			await this._turnedOff();
			return this.turnOff(callback);
		}
	}

	public async setWarmWhite(
		ww: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		await this._turnedOn();

		const color = (await this.getColor()) ?? new Color(255);
		await this._client.setColor([color.r, color.g, color.b, ww]);
		this.updateStateColor(color, 100);
		callback?.(null, true);
		return Promise.resolve(true);
	}

	public async turnOff(callback?: () => void): Promise<boolean> {
		await this._turnedOff();
		await this._client.turnOff();
		callback?.();
		return Promise.resolve(true);
	}

	public async turnOn(callback?: () => void): Promise<boolean> {
		await this._turnedOn();
		await this._client.turnOn();
		callback?.();
		return Promise.resolve(true);
	}
}
