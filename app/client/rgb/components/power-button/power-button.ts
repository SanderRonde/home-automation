import {
	ConfigurableWebComponent,
	Props,
	PROP_TYPE,
	config,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { PowerButtonHTML } from './power-button.html.js';
import { PowerButtonCSS } from './power-button.css.js';
import { RGBController } from '../rgb-controller/rgb-controller.js';

@config({
	is: 'power-button',
	css: PowerButtonCSS,
	html: PowerButtonHTML,
})
export class PowerButton extends ConfigurableWebComponent {
	props = Props.define(this, {
		reflect: {
			on: {
				type: PROP_TYPE.BOOL,
				value: false,
			},
		},
	});

	setPower(state: boolean) {
		this.props.on = state;
	}

	onClick() {
		this.props.on = !this.props.on;
		this.getRoot<RGBController>().setPower(this.props.on);
	}
}
