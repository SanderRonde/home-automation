import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { ColorControls } from './color-controls.js';

export const ColorControlsHTML = new TemplateFn<ColorControls>(function (html) {
	return html`
		<div id="container"></div>
	`
}, CHANGE_TYPE.PROP, render);
