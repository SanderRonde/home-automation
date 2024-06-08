import {
	ConfigurableWebComponent,
	Props,
	PROP_TYPE,
	config,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import type { RGBController } from '../rgb-controller/rgb-controller.js';
import { PowerButtonHTML } from './power-button.html.js';
import { PowerButtonCSS } from './power-button.css.js';

@config({
	is: 'power-button',
	css: PowerButtonCSS,
	html: PowerButtonHTML,
})
export class PowerButton extends ConfigurableWebComponent {
	public props = Props.define(this, {
		reflect: {
			on: {
				type: PROP_TYPE.BOOL,
				value: false,
			},
		},
	});

	public setPower(state: boolean): void {
		this.props.on = state;
	}

	public async onClick(): Promise<void> {
		this.props.on = !this.props.on;
		await this.getRoot<RGBController>().setPower(this.props.on);
	}
}
