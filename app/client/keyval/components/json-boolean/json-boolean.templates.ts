import { CHANGE_TYPE, TemplateFn } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { clampWidthSelector, clampWidth } from '../css-util.js';
import { JSONBoolean } from './json-boolean.js';

export const JSONBooleanHTML = new TemplateFn<JSONBoolean>(function (html, props) {
	return html`
		<div id="container">
			<div title="${props.path.join('.')}" id="name">${props.name}</div>
			<div id="switchContainer">
				<power-switch id="switch" @@toggle="${this.onToggle}" ?initial="${(() => {
					if (typeof props.value === 'number') {
						return props.value > 0;
					} else if (typeof props.value === 'boolean') {
						return props.value;
					} else if (typeof props.value === 'string') {
						return parseInt(props.value, 10) > 0;
					} else {
						return false;
					}
				})()}"></power-switch>
			</div>
		</div>
	`;
}, CHANGE_TYPE.PROP, render);

export const JSONBooleanCSS = new TemplateFn<JSONBoolean>((html) => {
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
				['height', '14.5vw'],
				['margin-right', '2vw']
			)}

			#name {
				text-align: center;
			}

			${clampWidthSelector('#name')(
				['font-size', '10vw'],
				['margin-left', '3.5vw']
			)}

			#switchContainer {
				margin-left: -10px;
				position: relative;
				display: flex;
				flex-direction: column;
				justify-content: center;
			}

			${clampWidth('#switchContainer', 'right', '5vw')}
		</style>
	`;
}, CHANGE_TYPE.NEVER, render);