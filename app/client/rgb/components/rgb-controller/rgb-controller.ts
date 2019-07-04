import { ComplexType, config, ConfigurableWebComponent, Props, PROP_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { RGBControllerHTML, RGBControllerCSS } from './rgb-controller.templates.js';
import { PatternButton } from '../pattern-button/pattern-button.js';
import { ColorDisplay } from '../color-display/color-display.js';
import { TransitionTypes } from 'magic-home';

export interface PatternConfig {
	defaultSpeed: number;
	colors: {
		red: number;
		green: number;
		blue: number;
	}[];
	transitionType: TransitionTypes;
}

@config({
	is: 'rgb-controller',
	html: RGBControllerHTML,
	css: RGBControllerCSS,
	dependencies: [
		PatternButton,
		ColorDisplay
	]
})
export class RGBController extends ConfigurableWebComponent {
	props = Props.define(this, {
		reflect: {
			key: PROP_TYPE.STRING,
			patterns: ComplexType<PatternConfig[]>()
		}
	});
}