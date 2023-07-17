import {
	CHANGE_TYPE,
	TemplateFn,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import {
	clampWidthSelector,
	clampWidth,
} from '../../../shared/css-util/css-util.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import { jsonValue } from '../json-value/json-value.templates.js';
import { JSONObject } from './json-object.js';

function getKeys(value: unknown): (string | number)[] {
	if (Array.isArray(value)) {
		return value.map((_, index) => index);
	} else {
		return Object.getOwnPropertyNames(value);
	}
}

function getDeepValues(value: unknown): unknown[] {
	if (typeof value === 'object') {
		return getKeys(value)
			.map((key) => {
				return getDeepValues((value as Record<string, unknown>)[key]);
			})
			.reduce((prev, current) => {
				return [...prev, ...current];
			}, []);
	}
	return [value];
}

export const JSONObjectHTML = new TemplateFn<JSONObject>(
	function (html, { props }) {
		return html`
			<div id="header">
				<div id="name">${props.name}</div>
				<div id="groupToggle">
					<power-switch
						id="switch"
						@@toggle="${this.onToggle.bind(this)}"
						?initial="${(() => {
							const deepVals = getDeepValues(props.json);
							if (
								deepVals.filter((val) => {
									if (typeof val === 'string') {
										return parseInt(val, 10) > 0;
									} else if (typeof val === 'number') {
										return val > 0;
									} else if (typeof val === 'boolean') {
										return val;
									}
									return true;
								}).length === deepVals.length
							) {
								// All ones
								return true;
							}
							return false;
						})()}"
					></power-switch>
				</div>
			</div>
			<div id="subsection">
				${getKeys(props.json)
					.map((key) => {
						if (key === '___last_updated') {
							return null;
						}
						return jsonValue(
							html,
							(props.json as Record<string, unknown>)[key],
							[...props.path!, String(key)],
							String(key)
						);
					})
					.filter((v) => !!v)}
			</div>
		`;
	},
	CHANGE_TYPE.PROP,
	render
);

export const JSONObjectCSS = new TemplateFn<JSONObject>(
	(html) => {
		return html`
			<style>
				#background {
					width: 100vw;
					max-width: 1000px;
					height: 100vh;
					background-color: rgb(70, 70, 70);
				}

				#header {
					height: 50px;
					display: flex;
					flex-direction: row;
					justify-content: space-between;
					background-color: rgb(115, 115, 115);
					color: rgb(217, 217, 217);
					margin-right: 20px;
					font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
				}

				${clampWidthSelector('#header')(
					['height', '50px'],
					['margin-right', '20px']
				)}

				#name {
					font-size: 200%;
					font-weight: bold;
					margin-left: 20px;
					text-align: center;
				}

				${clampWidthSelector('#name')(
					['font-size', '200%'],
					['margin-left', '20px']
				)}

				#groupToggle {
					margin-left: -10px;
					position: relative;
					display: flex;
					flex-direction: column;
					justify-content: center;
				}

				${clampWidth('#groupToggle', 'right', '20px')}

				${clampWidthSelector('#subsection')(
					['margin-left', '20px'],
					['margin-top', '20px']
				)}
			</style>
		`;
	},
	CHANGE_TYPE.NEVER,
	render
);
