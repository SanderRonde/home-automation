import { ConfigurableWebComponent, Props, PROP_TYPE, config } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorButtonHTML } from './color-button.html.js';
import { ColorButtonCSS } from './color-button.css.js';

@config({
	is: 'color-button',
	css: ColorButtonCSS,
	html: ColorButtonHTML
})
export class ColorButton extends ConfigurableWebComponent {
	props = Props.define(this, {
		// ...
	});

	mounted() {
		// ...
	}

	firstRender() {
		// ...
	}
}