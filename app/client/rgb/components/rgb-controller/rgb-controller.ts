import { ComplexType, config, ConfigurableWebComponent, Props, PROP_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { RGBControllerHTML, RGBControllerCSS } from './rgb-controller.templates.js';
import { PatternButton } from '../pattern-button/pattern-button.js';
import { ColorControls } from '../color-controls/color-controls.js';
import { ColorDisplay } from '../color-display/color-display.js';
import { ColorButton } from '../color-button/color-button.js';
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
		selected: boolean;
	}
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
		ColorControls
	]
})
export class RGBController extends ConfigurableWebComponent<{
	IDS: {
		display: ColorDisplay;
		controls: ColorControls;
	}
	CLASSES: {};
}> {
	props = Props.define(this, {
		reflect: {
			key: PROP_TYPE.STRING,
			patterns: ComplexType<PatternConfig[]>()
		}
	});

	deselectAll() {
		(<ColorOption[]><unknown>this.$$('.button')).forEach((button) => {
			button.props.selected = false;
		});
	}

	setSelected(selected: ColorOption) {
		selected.props.selected = true;
		selected.setDisplay(this.$.display);
		selected.setControls(this.$.controls);
	}

	setColor(color: [number, number, number]) {
		console.log('Setting color to', color);
	}

	setPattern(patternName: string, speed: number, transitionType: TransitionTypes) {
		console.log('Setting pattern to', patternName, 'with speed',
			speed, 'and transition type', transitionType);
	}
}