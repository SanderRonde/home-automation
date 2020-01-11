interface Color {
	red: number;
	green: number;
	blue: number;
}

interface State {
	type: number;
	on: boolean;
	mode: TransitionTypes;
	speed: number;
	color: Color;
	warm_white?: number;
	cold_white?: number;
}

interface Options {
	wait_for_reply?: boolean;
	log_all_received?: boolean;
	apply_masks?: boolean;
}

type BuiltinPatterns =
	| 'seven_color_cross_fade'
	| 'red_gradual_change'
	| 'green_gradual_change'
	| 'blue_gradual_change'
	| 'yellow_gradual_change'
	| 'cyan_gradual_change'
	| 'purple_gradual_change'
	| 'white_gradual_change'
	| 'red_green_cross_fade'
	| 'red_blue_cross_fade'
	| 'green_blue_cross_fade'
	| 'seven_color_strobe_flash'
	| 'red_strobe_flash'
	| 'green_strobe_flash'
	| 'blue_stobe_flash'
	| 'yellow_strobe_flash'
	| 'cyan_strobe_flash'
	| 'purple_strobe_flash'
	| 'white_strobe_flash'
	| 'seven_color_jumping';

export class Control {
	static patternNames: {
		[key in BuiltinPatterns]: number;
	};
	constructor(address: string, options?: Options);
	queryState(callback?: (state: State) => void): Promise<State>;
	setColor(
		red: number,
		green: number,
		blue: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	setColorAndWarmWhite(
		red: number,
		green: number,
		blue: number,
		ww: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	setColorWithBrightness(
		red: number,
		green: number,
		blue: number,
		brightness: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	setCustomPattern(
		pattern: CustomMode,
		speed: number,
		callback?: () => void
	): Promise<boolean>;
	setPattern(
		pattern: BuiltinPatterns,
		speed: number,
		callback?: () => void
	): Promise<boolean>;
	setPower(on: boolean, callback?: () => void): Promise<boolean>;
	setWarmWhite(
		ww: number,
		callback?: (err: Error | null, success: boolean) => void
	): Promise<boolean>;
	startEffectMode(
		callback?: (interface: EffectInterface) => void
	): Promise<EffectInterface>;
	turnOff(callback?: () => void): Promise<boolean>;
	turnOn(callback?: () => void): Promise<boolean>;
}

export declare class EffectInterface {
	constructor(
		address: string,
		port: number,
		options: Options,
		callback: (err: Error | null, interface: EffectInterface) => void
	);

	start(interval_function: () => void): void;
	setColor(red: number, green: number, blue: number): void;
	delay(milliseconds: number): void;
	stop(): void;

	connected: boolean;
}

export type TransitionTypes = 'fade' | 'jump' | 'strobe';

export class CustomMode {
	static transitionTypes: TransitionTypes[];
	addColor(red: number, green: number, blue: number): this;
	addColorList(list: [number, number, number][]): this;
	setTransitionType(type: TransitionTypes): this;

	transitionType: TransitionTypes;
	colors: {
		red: number;
		green: number;
		blue: number;
	}[];
}

export interface Client {
	address: string;
	id: string;
	model: string;
}

export class Discovery {
	static scan(timeout: number): Discovery;
	scan(
		timeout?: number,
		callback?: (devices: Client[]) => void
	): Promise<Client[]>;

	clients: Client[];
	scanned: boolean;
}
