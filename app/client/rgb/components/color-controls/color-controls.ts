import {
	ConfigurableWebComponent,
	config,
} from '../../../../../node_modules/wc-lib/build/es/wc-lib.js';
import { ColorControlsHTML } from './color-controls.html.js';
import { ColorControlsCSS } from './color-controls.css.js';

@config({
	is: 'color-controls',
	css: ColorControlsCSS,
	html: ColorControlsHTML,
})
export class ColorControls extends ConfigurableWebComponent<{
	selectors: {
		IDS: {
			container: HTMLElement;
		};
		CLASSES: Record<string, never>;
	};
}> {
	appendElement(element: HTMLElement): void {
		Array.from(this.$.container.children).forEach((el) => el.remove());
		this.$.container.appendChild(element);
	}
}
