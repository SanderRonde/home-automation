declare module 'wled-client' {
	interface WLEDState {
		on: boolean;
		brightness: number;
		segments: {
			colors: [number, number, number][];
		}[];
	}

	export class WLEDClient {
		constructor(address: string);
		init(): Promise<void>;
		setPreset(preset: number): Promise<void>;
		setPower(on: boolean): Promise<void>;
		setColor(
			color: [number, number, number] | [number, number, number, number],
			options?: {
				method?: 'ws' | 'http';
			}
		): Promise<void>;
		setBrightness(brightness: number): Promise<void>;
		setWarmWhite(warmWhite: number): Promise<void>;
		turnOn(): Promise<void>;
		turnOff(): Promise<void>;

		updateState(state: Partial<WLEDState>): Promise<void>;
		state: WLEDState;
	}
}
