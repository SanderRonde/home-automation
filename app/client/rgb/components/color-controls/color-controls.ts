import { ConfigurableWebComponent, Props, config } from '../../../../../node_modules/wclib/build/es/wclib.js';
import { ColorControlsHTML } from './color-controls.html.js';
import { ColorControlsCSS } from './color-controls.css.js';

@config({
	is: 'color-controls',
	css: ColorControlsCSS,
	html: ColorControlsHTML
})
export class ColorControls extends ConfigurableWebComponent<{
	IDS: {
		container: HTMLElement;
	};
	CLASSES: {};
}> {
	props = Props.define(this, {
		// ...
	});

	appendElement(element: HTMLElement) {
		Array.from(this.$.container.children).forEach(el => el.remove());
		this.$.container.appendChild(element);
	}
}