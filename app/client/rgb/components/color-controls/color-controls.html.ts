import {
	TemplateFn,
	CHANGE_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { ColorControls } from './color-controls.js';

export const ColorControlsHTML = new TemplateFn<ColorControls>(
	function(html) {
		return html`
			<div id="container"></div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);
