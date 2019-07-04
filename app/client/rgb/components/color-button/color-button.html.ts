import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorButton } from './color-button.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorButtonHTML = new TemplateFn<ColorButton>(function (html, props) {
	return html`
		<div></div>
	`
}, CHANGE_TYPE.PROP, render);
