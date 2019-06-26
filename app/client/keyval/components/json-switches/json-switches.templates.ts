import { CHANGE_TYPE, TemplateFn } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { clampWidthSelector } from '../css-util.js';
import { JSONSwitches } from './json-switches.js';

export const JSONSwitchesHTML = new TemplateFn<JSONSwitches>((html, props) => {
	return html`
		<div id="background">
			<json-value id="jsonValue" #value="${props.json}" #path="${[]}"></json-value>
		</div>
	`;
}, CHANGE_TYPE.PROP, render);

export const JSONSwitchesCSS = new TemplateFn<JSONSwitches>((html) => {
	return html`
		<style>
			#background {
				width: 100vw;
				max-width: 1000px;
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
}, CHANGE_TYPE.NEVER, render);