import {
	ConfigurableWebComponent,
	config,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { ColorDisplayHTML } from './color-display.html.js';
import { ColorDisplayCSS } from './color-display.css.js';

@config({
	is: 'color-display',
	css: ColorDisplayCSS,
	html: ColorDisplayHTML,
})
export class ColorDisplay extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			display: HTMLElement;
		};
		CLASSES: Record<string, never>;
	};
}> {
	appendElement(el: HTMLElement): void {
		Array.from(this.$.display.children).forEach((el) => {
			el.remove();
		});

		this.$.display.appendChild(el);
	}
}
