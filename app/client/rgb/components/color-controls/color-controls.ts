import { ConfigurableWebComponent, Props, PROP_TYPE, config } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorControlsHTML } from './color-controls.html.js';
import { ColorControlsCSS } from './color-controls.css.js';

@config({
	is: 'color-controls',
	css: ColorControlsCSS,
	html: ColorControlsHTML
})
export class ColorControls extends ConfigurableWebComponent {
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