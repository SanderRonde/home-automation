import {
	TemplateFn,
	CHANGE_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { RgbControls } from './rgb-controls.js';

export const RgbControlsHTML = new TemplateFn<RgbControls>(
	function (html) {
		return html`
			<div id="container">
				<input @input="${this.onChange}" id="hueSlider" type="range" />
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
