import { config, ConfigurableWebComponent, ComplexType, Props } from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { JSONBoolean } from '../json-boolean/json-boolean.js';
import { JSONObject } from '../json-object/json-object.js';
import { JSONValueHTML } from './json-value.templates.js';

@config({
	is: 'json-value',
	html: JSONValueHTML,
	dependencies: [
		JSONObject,
		JSONBoolean
	]
})
export class JSONValue extends ConfigurableWebComponent {
	props = Props.define(this, {
		reflect: {
			value: {
				value: {},
				type: ComplexType<any>()
			},
			path: {
				value: [],
				type: ComplexType<string[]>()
			}
		}
	});
}