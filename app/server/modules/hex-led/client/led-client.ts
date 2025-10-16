/* eslint-disable no-restricted-globals */
import { logTag, warning } from '../../../lib/logging/logger';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Socket } from 'socket.io-client';
import { Data } from '../../../lib/data';
import { io } from 'socket.io-client';

export interface LEDState {
	power_state: boolean;
	target_power_state: boolean;
	brightness: number;
	active_preset_id: number | undefined;
}

export interface LEDEffectParameter {
	type: 'float' | 'color' | 'enum' | 'color_list';
	description: string;
	value: unknown;
	enum_values?: string[];
}

export interface LEDEffects {
	effect_parameters: Record<string, Record<string, LEDEffectParameter>>;
	effect_names: Record<string, string>;
	current_effect: string;
}

export interface LEDPreset {
	id: number;
	name: string;
	effect: string;
	brightness: number;
	parameters: Record<string, unknown>;
}

export interface RGBColor {
	r: number;
	g: number;
	b: number;
}

export class LEDClient implements Disposable {
	private _socket: Socket | null = null;
	private _connected = false;

	public readonly state = new Data<LEDState>({
		power_state: false,
		target_power_state: false,
		brightness: 1.0,
		active_preset_id: undefined,
	});

	public readonly effects = new Data<LEDEffects>({
		effect_parameters: {},
		effect_names: {},
		current_effect: '',
	});

	public readonly presets = new Data<LEDPreset[]>([]);

	public readonly onChange = new EventEmitter<void>();

	public constructor(private readonly _url: string) {}

	public async connect(): Promise<void> {
		if (this._connected) {
			return;
		}

		try {
			this._socket = io(this._url, {
				reconnection: true,
				reconnectionDelay: 1000,
				reconnectionDelayMax: 5000,
				reconnectionAttempts: Infinity,
			});

			this._socket.on('connect', () => {
				logTag('HEX-LED', 'green', 'Connected to LED server:', this._url);
				this._connected = true;
			});

			this._socket.on('disconnect', (reason) => {
				logTag('HEX-LED', 'yellow', 'Disconnected from LED server:', reason);
				this._connected = false;
			});

			this._socket.on('connect_error', (error) => {
				warning('Failed to connect to LED server:', error);
			});

			this._socket.on('state_update', (data: LEDState) => {
				this.state.set(data);
				this.onChange.emit(undefined);
			});

			this._socket.on('effects_update', (data: LEDEffects) => {
				this.effects.set(data);
				this.onChange.emit(undefined);
			});

			this._socket.on('presets_update', (data: LEDPreset[]) => {
				this.presets.set(data);
				this.onChange.emit(undefined);
			});

			// Initial data fetch
			await this.refreshState();
			await this.refreshEffects();
			await this.refreshPresets();
		} catch (error) {
			warning('Failed to initialize LED client:', error);
			throw error;
		}
	}

	public disconnect(): void {
		if (this._socket) {
			this._socket.disconnect();
			this._socket = null;
		}
		this._connected = false;
	}

	public async refreshState(): Promise<void> {
		try {
			const response = await fetch(`${this._url}/state`);
			if (!response.ok) {
				throw new Error(`Failed to fetch state: ${response.status}`);
			}
			const data = (await response.json()) as LEDState;
			this.state.set(data);
		} catch (error) {
			warning('Failed to refresh LED state:', error);
		}
	}

	public async setState(args: { power_state?: boolean; brightness?: number }): Promise<void> {
		try {
			const response = await fetch(`${this._url}/state`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(args),
			});
			if (!response.ok) {
				throw new Error(`Failed to set state: ${response.status}`);
			}
			const data = (await response.json()) as LEDState;
			this.state.set(data);
		} catch (error) {
			warning('Failed to set LED state:', error);
			throw error;
		}
	}

	public async refreshEffects(): Promise<void> {
		try {
			const response = await fetch(`${this._url}/effects`);
			if (!response.ok) {
				throw new Error(`Failed to fetch effects: ${response.status}`);
			}
			const data = (await response.json()) as LEDEffects;
			this.effects.set(data);
		} catch (error) {
			warning('Failed to refresh LED effects:', error);
		}
	}

	public async setEffect(args: {
		effect_name: string;
		parameters?: Record<string, unknown>;
	}): Promise<void> {
		try {
			const response = await fetch(`${this._url}/effects`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(args),
			});
			if (!response.ok) {
				throw new Error(`Failed to set effect: ${response.status}`);
			}
			await this.refreshEffects();
		} catch (error) {
			warning('Failed to set LED effect:', error);
			throw error;
		}
	}

	public async refreshPresets(): Promise<void> {
		try {
			const response = await fetch(`${this._url}/presets`);
			if (!response.ok) {
				throw new Error(`Failed to fetch presets: ${response.status}`);
			}
			const data = (await response.json()) as LEDPreset[];
			this.presets.set(data);
		} catch (error) {
			warning('Failed to refresh LED presets:', error);
		}
	}

	public async applyPreset(preset: LEDPreset): Promise<void> {
		try {
			const response = await fetch(`${this._url}/presets/apply`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					effect: preset.effect,
					brightness: preset.brightness,
					parameters: preset.parameters,
				}),
			});
			if (!response.ok) {
				throw new Error(`Failed to apply preset: ${response.status}`);
			}
			await this.refreshState();
			await this.refreshEffects();
		} catch (error) {
			warning('Failed to apply LED preset:', error);
			throw error;
		}
	}

	public [Symbol.dispose](): void {
		this.disconnect();
	}
}
