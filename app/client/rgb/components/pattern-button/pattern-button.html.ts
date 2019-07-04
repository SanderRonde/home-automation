import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { PatternButton } from './pattern-button.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const PatternButtonHTML = new TemplateFn<PatternButton>(function (html) {
	return html`
		<div id="container">
			<div id="outline">
				<div id="pattern"></div>
			</div>
		</div>
	`
}, CHANGE_TYPE.NEVER, render);
