import {
	TemplateFn,
	CHANGE_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { ColorControls } from './color-controls.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorControlsCSS = new TemplateFn<ColorControls>(
	function(html) {
		return html`
			<style></style>
		`;
	},
	CHANGE_TYPE.THEME,
	render
);
