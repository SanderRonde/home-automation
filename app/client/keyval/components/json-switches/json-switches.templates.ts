import {
	CHANGE_TYPE,
	TemplateFn,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { clampWidthSelector } from '../../../shared/css-util/css-util.js';
import type { JSONSwitches } from './json-switches.js';

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
	(html) => {
		return html`
			<style>
				#background {
					width: 100vw;
					max-width: 450px;
					height: 100vh;
					background-color: rgb(70, 70, 70);
					margin-left: auto;
					margin-right: auto;
				}

				#jsonValue {
					display: block;
				}

				${clampWidthSelector('#jsonValue')(
					['margin-top', '20px'],
					['margin-left', '20px']
				)}
			</style>
		`;
	},
	CHANGE_TYPE.NEVER,
	render
);
