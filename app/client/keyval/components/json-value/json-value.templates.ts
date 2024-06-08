import type {
	Templater,
	TemplateRenderResult,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import {
	CHANGE_TYPE,
	TemplateFn,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { render } from '../../../../../node_modules/lit-html/lit-html.js';
import type { JSONValue } from './json-value.js';

export function jsonValue(
	html: Templater<TemplateRenderResult>,
	value: unknown,
	path: string[],
	name = 'all'
): TemplateRenderResult {
	if (
		typeof value === 'boolean' ||
		typeof value === 'number' ||
		typeof value === 'string'
	) {
		return html`
			<json-boolean
				#path="${path}"
				name="${name}"
				value="${value}"
			></json-boolean>
		`;
	} else if (typeof value === 'object') {
		return html`
			<json-object
				#path="${path}"
				name="${name}"
				#json="${value}"
			></json-object>
		`;
	}
	return '';
}

export const JSONValueHTML = new TemplateFn<JSONValue>(
	(html, { props }) => {
		return html` ${jsonValue(html, props.value, props.path)} `;
	},
	CHANGE_TYPE.PROP,
	render
);
