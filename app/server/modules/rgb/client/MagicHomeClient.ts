import { BuiltinPatterns, Control, State } from 'magic-home';
import { MAGIC_LEDS } from '@server/config/led-config';
import { warning } from '@server/lib/logger';
import { Color } from '@server/lib/color';
import { RGBClient } from '@server/modules/rgb/client/RGBClient';

export class MagicHomeClient extends RGBClient {
	private _lastQueriedState: State | null = null;
	public id = (() => {
		const name = MAGIC_LEDS[this.address];
		if (!name) {
			warning(
				`Found magic-home LED without valid name (ip = "${this.address}")`
			);
		}
		return name;
	})();
	public setWhiteForPower = false;

	public constructor(
		private readonly _control: Control,
		public address: string
	) {
		super();
	}

	/**
	 * Get the last queried state. If it's been requested
	 * in the last 100ms a cached version is returned
	 */
	private async _queryState() {
		if (this._lastQueriedState) {
			return this._lastQueriedState;
		}
		const state = await this._control.queryState();
		this._lastQueriedState = state;
		setTimeout(() => {
			this._lastQueriedState = null;
		}, 100);
		return state;
	}

	private _withinRange(value: number, target: number, range: number) {
		return Math.abs(target - value) <= range;
	}

	private _isScaledColor(
		fullColor: Color,
		scaledColor: Color,
		scale: number
	) {
		return (
			this._withinRange(fullColor.r * scale, scaledColor.r, 5) &&
			this._withinRange(fullColor.g * scale, scaledColor.g, 5) &&
			this._withinRange(fullColor.b * scale, scaledColor.b, 5)
		);
	}

	private async _setSolidColor(
		red: number,
		green: number,
		blue: number,
		brightness = 100,
		callback?: (err: Error | null, success: boolean) => void
	) {
		await this._turnedOn();
		this.updateStateColor(new Color(red, green, blue), brightness);
		return this._control.setColorWithBrightness(
			red,
			green,
			blue,
			brightness || 100,
			callback
		);
	}

	public isOn(): Promise<boolean> {
		// Respond now, query state and if they mismatch send
		// an update
		const currentlyOn = this._lastState.type !== 'off';
		void this._queryState().then((state) => {
			if (currentlyOn !== state.on) {
				this._updateStatePower(state.on);
			}
		});
		return Promise.resolve(currentlyOn);
	}

	public getColor(): Promise<Color | null> {
		// Respond now, query state and if they mismatch send
		// an update
		const { assumedColor, assumedBrightness } = (() => {
			if (this._lastState.type === 'fullColor') {
				return {
					assumedColor: this._lastState.color,
					assumedBrightness: this._lastState.brightness,
				};
			}
			return {
				assumedColor: null,
				assumedBrightness: null,
			};
		})();

		void (async () => {
			const actualColor = await (async () => {
				const state = await this._queryState();
				if (state.mode !== 'color') {
					return null;
				}
				if (
					this._lastState.type === 'fullColor' &&
					this._isScaledColor(
						this._lastState.color,
						new Color(state.color),
						this._lastState.brightness
					)
				) {
					return this._lastState.color;
				}
				return null;
			})();

			if ((assumedColor === null) !== (actualColor === null)) {
				// One is defined and the other is not, update
				if (actualColor === null) {
					this._updateStatePower(false);
				} else {
					this.updateStateColor(actualColor, 100);
				}
				return;
			}
			if (
				assumedColor &&
				!assumedColor.isSame(actualColor!) &&
				!this._isScaledColor(
					assumedColor,
					actualColor!,
					assumedBrightness
				)
			) {
				// Color is defined and not the same
				this.updateStateColor(actualColor!, 100);
				return;
			}
			// One is not defined, meaning both are not defined,
			// meaning we're good
		})();
		return Promise.resolve(assumedColor);
	}

	public async getBrightness(): Promise<number | null> {
		// Check for the last color we sent from this server.
		// If the colors match, we know the brightness (since we set it).
		// If the colors differ, it was set in a different way and
		// we just return null
		const actualColor = await this.getColor();
		if (!actualColor) {
			return null;
		}

		if (
			this._lastState.type === 'fullColor' &&
			actualColor.isSame(this._lastState.color)
		) {
			return this._lastState.brightness;
		}
		return null;
	}

	public async setColor(
		red: number,
		green: number,
		blue: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		return this._setSolidColor(
			red,
			green,
			blue,
			(await this.getBrightness()) || 100,
			callback
		);
	}

	public async setBrightness(brightness: number): Promise<boolean> {
		const color = (await this.getColor()) || new Color(255, 255, 255);
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
		_ww: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		return this._setSolidColor(red, green, blue, 100, callback);
	}

	public async setColorWithBrightness(
		red: number,
		green: number,
		blue: number,
		brightness: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		return this._setSolidColor(red, green, blue, brightness, callback);
	}

	public async setPattern(
		pattern: BuiltinPatterns,
		speed: number,
		callback?: () => void
	): Promise<boolean> {
		await this._turnedOn();
		this.updateStateEffect(pattern);
		return this._control.setPattern(pattern, speed, callback);
	}

	public setPreset(): Promise<boolean> {
		throw new Error('Method not implemented.');
	}

	public async setPower(
		on: boolean,
		callback?: () => void
	): Promise<boolean> {
		if (on) {
			await this._turnedOn();
		} else {
			await this._turnedOff();
		}
		return this._control.setPower(on, callback);
	}

	public async setWarmWhite(
		ww: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		await this._turnedOn();

		this.updateStateColor(new Color(255), 100);
		return this._control.setWarmWhite(ww, callback);
	}

	public async turnOff(callback?: () => void): Promise<boolean> {
		await this._turnedOff();
		return this._control.turnOff(callback);
	}

	public async turnOn(callback?: () => void): Promise<boolean> {
		await this._turnedOn();
		return this._control.turnOn(callback);
	}
}
