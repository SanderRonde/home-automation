import { ComplexType, config, ConfigurableWebComponent, Props, PROP_TYPE, bindToClass } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { JSONObjectHTML, JSONObjectCSS } from './json-object.templates.js';
import { MessageToast } from '../message-toast/message-toast.js';
import { JSONSwitches } from '../json-switches/json-switches.js';
import { PowerSwitch } from '../power-switch/power-switch.js';

@config({
	is: 'json-object',
	html: JSONObjectHTML,
	css: JSONObjectCSS,
	dependencies: [
		PowerSwitch,
		MessageToast
	]
})
export class JSONObject extends ConfigurableWebComponent<{
	IDS: {
		switch: PowerSwitch;
	}
	CLASSES: {};
}> {
	props = Props.define(this, {
		reflect: {
			json: {
				value: {},
				type: ComplexType<any>()
			},
			name: {
				type: PROP_TYPE.STRING
			},
			path: {
				type: ComplexType<string[]>()
			}
		}
	});

	@bindToClass
	onToggle() {
		const root = this.getRoot<JSONSwitches>();
		if (!root) {
			MessageToast.create({
				message: 'Failed to find root element',
				duration: 5000
			});
			return;
		}
		
		root.changeValue(this.props.path, this.$.switch.checked ? '1' : '0');
	}
}