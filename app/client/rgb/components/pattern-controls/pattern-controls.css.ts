import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PatternControls } from './pattern-controls.js';

export const PatternControlsCSS = new TemplateFn<PatternControls>(function (html) {
	return html`<style>
		
	</style>`
}, CHANGE_TYPE.THEME, render);
