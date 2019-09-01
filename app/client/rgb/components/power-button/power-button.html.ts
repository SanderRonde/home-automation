import { TemplateFn, CHANGE_TYPE } from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { PowerButton } from './power-button.js';

export const PowerButtonHTML = new TemplateFn<PowerButton>(function (html, props) {
	return html`
		<div class="${{
			on: props.on
		}}" @click="${this.onClick}" id="container"></div>
	`
}, CHANGE_TYPE.PROP, render);
