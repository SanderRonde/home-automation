import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorControls } from './color-controls.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorControlsHTML = new TemplateFn<ColorControls>(function (html, props) {
	return html`
		<div></div>
	`
}, CHANGE_TYPE.PROP, render);
