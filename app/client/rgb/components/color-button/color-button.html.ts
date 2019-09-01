import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { ColorButton } from './color-button.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';

export const ColorButtonHTML = new TemplateFn<ColorButton>(function (html, props) {
	return html`
		<div id="container" @click="${this.onClick}">
			<div ?selected="${props.selected}" id="image"></div>
		</div>
	`
}, CHANGE_TYPE.PROP, render);
