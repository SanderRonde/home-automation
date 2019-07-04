import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorButton } from './color-button.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorButtonCSS = new TemplateFn<ColorButton>(function (html) {
	return html`<style>
		
	</style>`
}, CHANGE_TYPE.THEME, render);
