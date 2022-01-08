import {
	ComplexType,
	config,
	ConfigurableWebComponent,
	Props,
	PROP_TYPE,
	bindToClass,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { MessageToast } from '../../../shared/message-toast/message-toast.js';
import { JSONObjectHTML, JSONObjectCSS } from './json-object.templates.js';
import { JSONSwitches } from '../json-switches/json-switches.js';
import { PowerSwitch } from '../power-switch/power-switch.js';

@config({
	is: 'json-object',
	html: JSONObjectHTML,
	css: JSONObjectCSS,
	dependencies: [PowerSwitch, MessageToast],
})
export class JSONObject extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			switch: PowerSwitch;
		};
		CLASSES: Record<string, never>;
	};
}> {
	public props = Props.define(this, {
		reflect: {
			json: {
				value: {},
				type: ComplexType<unknown>(),
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
