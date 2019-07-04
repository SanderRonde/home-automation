import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PatternControls } from './pattern-controls.js';

export const PatternControlsHTML = new TemplateFn<PatternControls>(function (html) {
	return html`
		<div></div>
	`
}, CHANGE_TYPE.PROP, render);
