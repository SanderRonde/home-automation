import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorControls } from './color-controls.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorControlsCSS = new TemplateFn<ColorControls>(function (html) {
	return html`<style>
		
	</style>`
}, CHANGE_TYPE.THEME, render);
