import {
	CHANGE_TYPE,
	TemplateFn,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import {
	clampWidthSelector,
	clampWidth,
} from '../../../shared/css-util/css-util.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import type { JSONBoolean } from './json-boolean.js';

export const JSONBooleanHTML = new TemplateFn<JSONBoolean>(
	function (html, { props }) {
		return html`
			<div id="container">
				<div title="${props.path!.join('.')}" id="name">
					${props.name}
				</div>
				<div id="switchContainer">
					<power-switch
						id="switch"
						@@toggle="${this.onToggle.bind(this)}"
						?initial="${(() => {
							if (typeof props.value === 'number') {
								return props.value > 0;
							} else if (typeof props.value === 'boolean') {
								return props.value;
							} else if (typeof props.value === 'string') {
								return parseInt(props.value, 10) > 0;
							} else {
								return false;
							}
						})()}"
					></power-switch>
				</div>
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);

export const JSONBooleanCSS = new TemplateFn<JSONBoolean>(
	(html) => {
		return html`
			<style>
				#container {
					display: flex;
					flex-direction: row;
					justify-content: space-between;
					background-color: rgb(92, 92, 92);
					color: rgb(217, 217, 217);
					font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
				}

				${clampWidthSelector('#container')(
					['height', '50px'],
					['margin-right', '10px']
				)}

				#name {
					text-align: center;
					font-size: 200%;
					margin-left: 20px;
				}

				#switchContainer {
					margin-left: -10px;
					position: relative;
					display: flex;
					flex-direction: column;
					justify-content: center;
				}

				${clampWidth('#switchContainer', 'right', '40px')}
			</style>
		`;
	},
	CHANGE_TYPE.NEVER,
	render
);
