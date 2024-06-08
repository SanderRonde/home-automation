import {
	bindToClass,
	ComplexType,
	config,
	ConfigurableWebComponent,
	Props,
	PROP_TYPE,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { MessageToast } from '../../../shared/message-toast/message-toast.js';
import { JSONBooleanHTML, JSONBooleanCSS } from './json-boolean.templates.js';
import type { JSONSwitches } from '../json-switches/json-switches.js';
import { PowerSwitch } from '../power-switch/power-switch.js';

@config({
	is: 'json-boolean',
	html: JSONBooleanHTML,
	css: JSONBooleanCSS,
	dependencies: [PowerSwitch, MessageToast],
})
export class JSONBoolean extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			switch: PowerSwitch;
		};
		CLASSES: Record<string, never>;
	};
}> {
	public props = Props.define(this, {
		reflect: {
			value: {
				type: ComplexType<number | boolean | string>(),
			},
			name: {
				type: PROP_TYPE.STRING,
			},
			path: {
				type: ComplexType<string[]>(),
			},
		},
	});

	@bindToClass
	public async onToggle(): Promise<void> {
		const root = this.getRoot<JSONSwitches>();
		if (!root) {
			await MessageToast.create({
				message: 'Failed to find root element',
				duration: 5000,
			});
			return;
		}

		await root.changeValue(
			this.props.path!,
			this.$.switch.checked ? '1' : '0'
		);
	}
}
