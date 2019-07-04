import { ConfigurableWebComponent, config } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorDisplayHTML } from './color-display.html.js';
import { ColorDisplayCSS } from './color-display.css.js';

@config({
	is: 'color-display',
	css: ColorDisplayCSS,
	html: ColorDisplayHTML
})
export class ColorDisplay extends ConfigurableWebComponent<{
	IDS: {
		display: HTMLElement;
	};
	CLASSES: {};
}> {
	appendElement(el: HTMLElement) {
		Array.from(this.$.display.children).forEach((el) => {
			el.remove();
		});

		this.$.display.appendChild(el);
	}
}