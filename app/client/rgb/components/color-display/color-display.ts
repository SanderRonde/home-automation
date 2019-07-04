import { ConfigurableWebComponent, Props, PROP_TYPE, config } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorDisplayHTML } from './color-display.html.js';
import { ColorDisplayCSS } from './color-display.css.js';

@config({
	is: 'color-display',
	css: ColorDisplayCSS,
	html: ColorDisplayHTML
})
export class ColorDisplay extends ConfigurableWebComponent {
	props = Props.define(this, {
		reflect: {
			bgStyle: PROP_TYPE.STRING
		}
	});
}