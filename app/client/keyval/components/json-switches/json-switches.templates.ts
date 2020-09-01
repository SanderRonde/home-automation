import {
	CHANGE_TYPE,
	TemplateFn
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { clampWidthSelector } from '../../../shared/css-util/css-util.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { JSONSwitches } from './json-switches.js';

export const JSONSwitchesHTML = new TemplateFn<JSONSwitches>(
	(html, { props }) => {
		return html`
			<div id="background">
				<json-value
					id="jsonValue"
					#value="${props.json}"
					#path="${[]}"
				></json-value>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);

export const JSONSwitchesCSS = new TemplateFn<JSONSwitches>(
	html => {
		return html`
			<style>
				#background {
					width: 100vw;
					height: 100vh;
					background-color: rgb(70, 70, 70);
					margin-left: auto;
					margin-right: auto;
				}

				#jsonValue {
					display: block;
				}

				${clampWidthSelector('#jsonValue')(
					['margin-top', '2vw'],
					['margin-left', '2vw']
				)}
			</style>
		`;
	},
	CHANGE_TYPE.NEVER,
	render
);
