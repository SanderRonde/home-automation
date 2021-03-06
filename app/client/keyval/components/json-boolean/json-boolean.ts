import {
	bindToClass,
	ComplexType,
	config,
	ConfigurableWebComponent,
	Props,
	PROP_TYPE
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { JSONBooleanHTML, JSONBooleanCSS } from './json-boolean.templates.js';
import { MessageToast } from '../../../shared/message-toast/message-toast.js';
import { JSONSwitches } from '../json-switches/json-switches.js';
import { PowerSwitch } from '../power-switch/power-switch.js';

@config({
	is: 'json-boolean',
	html: JSONBooleanHTML,
	css: JSONBooleanCSS,
	dependencies: [PowerSwitch, MessageToast]
})
export class JSONBoolean extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			switch: PowerSwitch;
		};
		CLASSES: {};
	};
}> {
	props = Props.define(this, {
		reflect: {
			value: {
				type: ComplexType<number | boolean | string>()
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

		root.changeValue(this.props.path!, this.$.switch.checked ? '1' : '0');
	}
}
