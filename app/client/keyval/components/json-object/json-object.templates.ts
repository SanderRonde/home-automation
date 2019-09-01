import { CHANGE_TYPE, TemplateFn } from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { clampWidthSelector, clampWidth } from '../../../shared/css-util/css-util.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { jsonValue } from '../json-value/json-value.templates.js';
import { JSONObject } from './json-object.js';

function getKeys(value: any): (string|number)[] {
	if (Array.isArray(value)) {
		return value.map((_, index) => index);
	} else {
		return Object.getOwnPropertyNames(value);
	}
}

function getDeepValues(value: any): any[] {
	if (typeof value === 'object') {
		return getKeys(value).map((key) => {
			return getDeepValues(value[key]);
		}).reduce((prev, current) => {
			return [...prev, ...current];
		}, []);
	}
	return [value];
}

export const JSONObjectHTML = new TemplateFn<JSONObject>(function (html, props) {
	return html`
		<div id="header">
			<div id="name">${props.name}</div>
			<div id="groupToggle">
				<power-switch id="switch" @@toggle="${this.onToggle}" ?initial="${(() => {
					const deepVals = getDeepValues(props.json);
					if (deepVals.filter((val) => {
						if (typeof val === 'string') {
							return parseInt(val, 10) > 0;
						} else if (typeof val === 'number') {
							return val > 0;
						} else if (typeof val === 'boolean') {
							return val;
						}
						return true;
					}).length === deepVals.length) {
						// All ones
						return true;
					}
					return false;
				})()}"></power-switch>
			</div>
		</div>
		<div id="subsection">
			${getKeys(props.json).map((key) => {
				if (key === '___last_updated') return null;
				return jsonValue(html, props.json[key], [...props.path!, key + ''], key + '');
			}).filter(v => !!v)}
		</div>
	`;
}, CHANGE_TYPE.PROP, render);

export const JSONObjectCSS = new TemplateFn<JSONObject>((html) => {
	return html`
		<style>
			#background {
				width: 100vw;
				max-width: 1000px;
				height: 100vh;
				background-color: rgb(70, 70, 70);
			}

			#header {
				height: 14.5vw;
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				background-color: rgb(115, 115, 115);
				color: rgb(217, 217, 217);
				margin-right: 2vw;
				font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
			}

			${clampWidthSelector('#header')(
				['height', '14.5vw'],
				['margin-right', '2vw']
			)}

			#name {
				font-size: 10vw;
				font-weight: bold;
				margin-left: 3.5vw;
				text-align: center;
			}

			${clampWidthSelector('#name')(
				['font-size', '10vw'],
				['margin-left', '3.5vw']
			)}

			#groupToggle {
				margin-left: -10px;
				position: relative;
				display: flex;
				flex-direction: column;
				justify-content: center;
			}

			${clampWidth('#groupToggle', 'right', '5vw')}

			${clampWidthSelector('#subsection')(
				['margin-left', '2vw'],
				['margin-top', '2vw']
			)}
		</style>
	`;
}, CHANGE_TYPE.NEVER, render);