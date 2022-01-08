import {
	ARDUINO_LEDS,
	HEX_LEDS,
	LED_IPS,
	LED_NAMES,
	MAGIC_LEDS,
	NAME_MAP,
} from '../../lib/constants';
import { BuiltinPatterns, Control, State } from 'magic-home';
import { warning } from '../../lib/logger';
import { Color } from '../../lib/color';
import { XHR } from '../../lib/util';
import { Board } from './board';
import { RGB } from '.';

export abstract class RGBClient {
	public static patternNames: {
		[key in BuiltinPatterns]: number;
	} = Control.patternNames;
	private _listeners: {
		type: 'color' | 'brightness' | 'effect' | 'power';
		listener: (value: unknown) => void;
	}[] = [];
	protected _lastState:
		| {
				type: 'fullColor';
				color: Color;
				brightness: number;
		  }
		| {
				type: 'effect';
				effectName: string;
		  }
		| {
				type: 'off';
		  }
		| {
				type: 'on';
		  } = {
		type: 'off',
	};

	public abstract address: string;
	public abstract id: string;

	private async _stateChange(value: string) {
		const name = this.address;
		if (name in NAME_MAP) {
			const keys = NAME_MAP[name as keyof typeof NAME_MAP];
			for (const key of keys) {
				await new (
					await RGB.modules
				).keyval.External({}, `RGB_NAMEMAP.${name}`).set(
					key,
					value,
					false
				);
			}
		}
	}

	protected async _turnedOn(): Promise<void> {
		await this._stateChange('1');
		this._updateStatePower(true);
	}

	protected async _turnedOff(): Promise<void> {
		this._lastState = {
			type: 'off',
		};
		await this._stateChange('0');
		this._updateStatePower(false);
	}

	protected _triggerListener(
		type: 'color' | 'brightness' | 'effect' | 'power',
		data: Color | number | string | boolean
	): void {
		this._listeners
			.filter((listener) => listener.type === type)
			.forEach(({ listener }) => listener(data));
	}

	protected _updateStatePower(isOn: boolean): void {
		const oldValue = this._lastState;
		this._lastState = isOn
			? { type: 'on' }
			: {
					type: 'off',
			  };

		if (oldValue.type !== this._lastState.type) {
			this._triggerListener('power', isOn);
		}
	}

	public abstract isOn(): Promise<boolean>;
	public abstract setColor(
		red: number,
		green: number,
		blue: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	public abstract setBrightness(
		brightness: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	public abstract setColorAndWarmWhite(
		red: number,
		green: number,
		blue: number,
		ww: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	public abstract setColorWithBrightness(
		red: number,
		green: number,
		blue: number,
		brightness: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	public abstract setPattern(
		pattern: BuiltinPatterns,
		speed: number,
		callback?: () => void
	): Promise<boolean>;
	public abstract setPower(
		on: boolean,
		callback?: () => void
	): Promise<boolean>;
	public abstract setWarmWhite(
		ww: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	public abstract turnOff(callback?: () => void): Promise<boolean>;
	public abstract turnOn(callback?: () => void): Promise<boolean>;

	public updateStateColor(color: Color, brightness: number): void {
		const oldValue = this._lastState;
		this._lastState = {
			type: 'fullColor',
			color: color,
			brightness: brightness,
		};

		if (oldValue.type !== this._lastState.type) {
			this._triggerListener('color', color);
			this._triggerListener('brightness', brightness);
			this._triggerListener('effect', 'color');
			if (oldValue.type === 'off') {
				this._triggerListener('power', true);
			}
			return;
		}
		if (!oldValue.color.isSame(color)) {
			this._triggerListener('color', color);
		}
		if (oldValue.brightness !== brightness) {
			this._triggerListener('brightness', brightness);
		}
	}

	public updateStateEffect(effectName: string): void {
		const oldValue = this._lastState;
		this._lastState = {
			type: 'effect',
			effectName,
		};

		if (oldValue.type !== this._lastState.type) {
			this._triggerListener('effect', effectName);
			if (oldValue.type === 'off') {
				this._triggerListener('power', true);
			}
			return;
		}
		if (oldValue.effectName !== effectName) {
			this._triggerListener('effect', effectName);
		}
	}

	public async getColor(): Promise<Color | null> {
		if (this._lastState.type === 'fullColor') {
			return Promise.resolve(this._lastState.color);
		}
		return Promise.resolve(null);
	}

	public async getBrightness(): Promise<number | null> {
		if (this._lastState.type === 'fullColor') {
			return Promise.resolve(this._lastState.brightness);
		}
		return Promise.resolve(null);
	}

	public async getEffect(): Promise<string | null> {
		if (this._lastState.type === 'effect') {
			return Promise.resolve(this._lastState.effectName);
		}
		if (this._lastState.type === 'fullColor') {
			return Promise.resolve('color');
		}
		return Promise.resolve(null);
	}

	public onColorChange(callback: (color: Color) => void): void {
		this._listeners.push({
			type: 'color',
			listener: callback,
		});
	}

	public onBrightnessChange(callback: (brightness: number) => void): void {
		this._listeners.push({
			type: 'brightness',
			listener: callback,
		});
	}

	public onEffectChange(callback: (effect: string) => void): void {
		this._listeners.push({
			type: 'effect',
			listener: callback,
		});
	}

	public onPowerChange(callback: (isOn: boolean) => void): void {
		this._listeners.push({
			type: 'power',
			listener: callback,
		});
	}
}

export class HexClient extends RGBClient {
	public id = LED_NAMES.HEX_LEDS;

	public constructor(public address: string) {
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
			)) as EncodedString<{ enabled: boolean }>;
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
			brightness
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

export class MagicHomeClient extends RGBClient {
	private _lastQueriedState: State | null = null;
	public id = (() => {
		const name = LED_IPS[this.address];
		if (!name) {
			warning(
				`Found magic-home LED without valid name (ip = "${this.address}")`
			);
		}
		return name;
	})();

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
					assumedBrightness!
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
			brightness
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

export class ArduinoClient extends RGBClient {
	public address: string;

	public id = LED_NAMES.CEILING_LEDS;

	public constructor(public board: Board) {
		super();
		this.address = board.name;
		board.client = this;
	}

	private _sendSuccess(
		callback?: (err: Error | null, success: boolean) => void
	) {
		callback?.(null, true);
		return true;
	}

	private async _setSolidColor(
		red: number,
		green: number,
		blue: number,
		brightness = 100,
		callback?: (err: Error | null, success: boolean) => void
	) {
		await this._turnedOn();
		await this.board.setSolid({
			r: red,
			g: green,
			b: blue,
		});
		this.updateStateColor(new Color(red, green, blue), brightness);
		return this._sendSuccess(callback);
	}

	public async isOn(): Promise<boolean> {
		return Promise.resolve(this._lastState.type !== 'off');
	}

	public async getColor(): Promise<Color | null> {
		if (this._lastState.type === 'fullColor') {
			return Promise.resolve(this._lastState.color);
		}
		return Promise.resolve(null);
	}

	public ping(): Promise<boolean> {
		return this.board.ping();
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

	public async setBrightness(
		brightness: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean> {
		const color =
			this._lastState.type === 'fullColor'
				? this._lastState.color
				: new Color(255);
		return this._setSolidColor(
			color.r,
			color.g,
			color.b,
			brightness,
			callback
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

	public setPattern(): Promise<boolean> {
		throw new Error('Not implemented');
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
		return this._setSolidColor(ww, ww, ww, 100, callback);
	}

	public async turnOff(callback?: () => void): Promise<boolean> {
		await this._turnedOff();
		this.board.setModeOff();
		return this._sendSuccess(callback);
	}

	public async turnOn(callback?: () => void): Promise<boolean> {
		await this._turnedOn();
		return this._sendSuccess(callback);
	}
}

// eslint-disable-next-line prefer-const
export let magicHomeClients: MagicHomeClient[] = [];
export const arduinoClients: ArduinoClient[] = [];
// eslint-disable-next-line prefer-const
export let hexClients: HexClient[] = [];
// eslint-disable-next-line prefer-const
export let clients: RGBClient[] = [];

export const arduinoBoards: Board[] = [];

export function getLed(
	name: LED_NAMES
): MagicHomeClient | ArduinoClient | HexClient | null {
	if (MAGIC_LEDS.includes(name)) {
		return (
			magicHomeClients.filter((client) => {
				return LED_IPS[client.address] === name;
			})[0] || null
		);
	} else if (ARDUINO_LEDS.includes(name)) {
		return arduinoClients[0] || null;
	} else if (HEX_LEDS.includes(name)) {
		return hexClients[0] || null;
	}
	return null;
}

export function setClients(
	newClients: (MagicHomeClient | ArduinoClient | HexClient)[]
): void {
	clients = newClients;
}

export function setMagicHomeClients(newClients: MagicHomeClient[]): void {
	magicHomeClients = newClients;
}

export function setHexClients(newClients: HexClient[]): void {
	hexClients = newClients;
}
