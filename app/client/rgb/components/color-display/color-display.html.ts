import {
	TemplateFn,
	CHANGE_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { ColorDisplay } from './color-display.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorDisplayHTML = new TemplateFn<ColorDisplay>(
	(html) => {
		return html`
			<div id="display">
				<div id="default"></div>
			</div>
		`;
	},
	CHANGE_TYPE.NEVER,
	render
);
