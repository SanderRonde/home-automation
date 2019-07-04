import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorDisplay } from './color-display.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorDisplayHTML = new TemplateFn<ColorDisplay>(function (html, props) {
	return html`
		<div id="display"></div>
	`
}, CHANGE_TYPE.NEVER, render);
