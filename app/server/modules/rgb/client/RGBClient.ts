import { LED_KEYVAL_MAP, LED_NAME } from '../../../config/led-config';
import { BuiltinPatterns, Control } from 'magic-home';
import { Color } from '../../../lib/color';
import { RGB } from '..';

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
	public abstract id: LED_NAME;
	/**
	 * When false, toggle power using `/on` and `/off`, when
	 * true, set color to white when using `/on`
	 */
	public abstract setWhiteForPower: boolean;

	private async _stateChange(value: string) {
		if (this.id in LED_KEYVAL_MAP) {
			const keys = LED_KEYVAL_MAP[this.id] ?? [];
			for (const key of keys) {
				await new (await RGB.modules).keyval.External(
					{},
					`RGB_NAMEMAP.${this.id}`
				).set(key, value, false);
			}
		}
	}

	protected async _turnedOn(): Promise<void> {
		await this._stateChange('1');
		this._updateStatePower(true);
	}

	protected async _turnedOff(): Promise<void> {
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
	/**
	 * @param {number} brightness - Number between 0 and 1
	 */
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
	public abstract setPreset(
		preset: number,
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
