import {
	ComplexType,
	config,
	Props
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import {
	RGBControllerHTML,
	RGBControllerCSS
} from './rgb-controller.templates.js';
import { MessageToast } from '../../../shared/message-toast/message-toast.js';
import { ServerComm } from '../../../shared/server-comm/server-comm.js';
import { PatternButton } from '../pattern-button/pattern-button.js';
import { ColorControls } from '../color-controls/color-controls.js';
import { ColorDisplay } from '../color-display/color-display.js';
import { ColorButton } from '../color-button/color-button.js';
import { PowerButton } from '../power-button/power-button.js';
import { TransitionTypes } from 'magic-home';

export interface PatternConfig {
	defaultSpeed: number;
	colors: {
		red: number;
		green: number;
		blue: number;
	}[];
	transitionType: TransitionTypes;
	name: string;
}

export interface ColorOption {
	props: {
		selected?: boolean | undefined;
	};
	setDisplay(display: ColorDisplay): void;
	setControls(controls: ColorControls): void;
}

@config({
	is: 'rgb-controller',
	html: RGBControllerHTML,
	css: RGBControllerCSS,
	dependencies: [
		PatternButton,
		ColorDisplay,
		ColorButton,
		ColorControls,
		PowerButton,
		MessageToast
	]
})
export class RGBController extends ServerComm<{
	IDS: {
		display: ColorDisplay;
		controls: ColorControls;
		power: PowerButton;
	};
	CLASSES: {};
}> {
	props = Props.define(
		this,
		{
			reflect: {
				patterns: ComplexType<PatternConfig[]>()
			}
		},
		super.props
	);

	deselectAll() {
		(<ColorOption[]>(<unknown>this.$$('.button'))).forEach(button => {
			button.props.selected = false;
		});
	}

	setSelected(selected: ColorOption) {
		selected.props.selected = true;
		selected.setDisplay(this.$.display);
		selected.setControls(this.$.controls);
	}

	async setColor([red, green, blue]: [number, number, number]) {
		await this.request(
			`${location.origin}/rgb/color/${red}/${green}/${blue}`,
			{},
			'Failed to set color'
		);
		this.$.power.setPower(true);
	}

	async setPattern(
		patternName: string,
		speed: number,
		transitionType: TransitionTypes
	) {
		await this.request(
			`${location.origin}/rgb/pattern/${patternName}/${speed}/${transitionType}`,
			{},
			'Failed to set pattern'
		);
		this.$.power.setPower(true);
	}

	async setPower(state: boolean) {
		await this.request(
			`${location.origin}/rgb/power/${state ? 'on' : 'off'}`,
			{},
			'Failed to set power'
		);
	}

	mounted() {
		this.props.patterns =
			this.props.patterns ||
			JSON.parse(localStorage.getItem('patterns')!);
		localStorage.setItem('patterns', JSON.stringify(this.props.patterns));
	}
}
